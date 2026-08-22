import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { createServer } from 'http';
import { URL } from 'url';
import { exec } from 'child_process';
import { runMain } from './lib/cli-utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_CREDENTIALS_PATH = 'gcp-oauth.keys.json';

// Loopback port for the OAuth callback. Must be registered as an authorized redirect
// URI on the OAuth client, and must be free — src/auth/server.ts's calendar flow scans
// 3500-3505, and a running MCP server also binds 3500. Override when 3500 is occupied:
//   GMAIL_AUTH_PORT=3505 npm run auth:gmail
// Check what Google actually accepts with scripts/check-redirect-uris.sh.
const DEFAULT_AUTH_PORT = 3500;
const AUTH_PORT = Number(process.env.GMAIL_AUTH_PORT) || DEFAULT_AUTH_PORT;
const REDIRECT_URI = `http://localhost:${AUTH_PORT}/oauth2callback`;

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic'
];

async function authGmail() {
  try {
    const credPath = process.env.GOOGLE_OAUTH_CREDENTIALS
      || path.join(__dirname, DEFAULT_CREDENTIALS_PATH);
    const credFile = JSON.parse(await fs.readFile(credPath, 'utf-8'));
    const cred = credFile.installed || credFile;

    const oauth2Client = new OAuth2Client(
      cred.client_id,
      cred.client_secret,
      REDIRECT_URI
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      prompt: 'consent',
    });

    console.log('Auth URL:', authUrl);

    const server = createServer(async (req, res) => {
      const urlObj = new URL(req.url, `http://localhost:${AUTH_PORT}`);
      const code = urlObj.searchParams.get('code');

      if (!code) {
        res.writeHead(400);
        res.end('No authorization code received');
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Save tokens
        const tokenDir = path.join(homedir(), '.config/google-calendar-mcp');
        await fs.mkdir(tokenDir, { recursive: true });

        const accountMode = process.env.ACCOUNT_MODE || 'normal';
        const tokenPath = path.join(tokenDir, 'tokens-gmail.json');

        let multiAccountTokens = {};
        try {
          const content = await fs.readFile(tokenPath, 'utf-8');
          multiAccountTokens = JSON.parse(content);
        } catch {
          // File doesn't exist yet
        }

        multiAccountTokens[accountMode] = tokens;
        await fs.writeFile(tokenPath, JSON.stringify(multiAccountTokens, null, 2), {
          mode: 0o600
        });

        console.log(`\nGmail tokens saved for account: ${accountMode}`);
        console.log(`Token path: ${tokenPath}`);

        res.writeHead(200);
        res.end('Gmail authentication successful! You can close this window.');
        server.close();

      } catch (error) {
        res.writeHead(500);
        res.end(`Error: ${error instanceof Error ? error.message : error}`);
        server.close();
      }
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${AUTH_PORT} is already in use.`);
        console.error('Free it, or pick another REGISTERED port: GMAIL_AUTH_PORT=<port> npm run auth:gmail');
        console.error('Run scripts/check-redirect-uris.sh to see which ports Google accepts.');
      } else {
        console.error('Auth server error:', error.message);
      }
      process.exit(1);
    });

    server.listen(AUTH_PORT, () => {
      console.log('Opening browser for Gmail authentication...');
      console.log('Waiting for authentication...');
      exec(`open "${authUrl}"`, (error) => {
        if (error) {
          console.log(`\nManually open this URL in your browser:\n${authUrl}`);
        }
      });
    });

  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

runMain(authGmail);
import { OAuth2Client } from 'google-auth-library';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';
import { createServer } from 'http';
import { URL } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Gmail scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic'
];

async function authGmail() {
  try {
    const credPath = path.join(__dirname, 'credentials.json');
    const credFile = JSON.parse(await fs.readFile(credPath, 'utf-8'));
    const cred = credFile.installed || credFile;

    const oauth2Client = new OAuth2Client(
      cred.client_id,
      cred.client_secret,
      'http://localhost:3500/oauth2callback'
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES
    });

    console.log('Opening browser for Gmail authentication...');
    console.log('Auth URL:', authUrl);

    const server = createServer(async (req, res) => {
      const urlObj = new URL(req.url, 'http://localhost:3500');
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

    server.listen(3500, () => {
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

authGmail().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
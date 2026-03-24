import { OAuth2Client } from 'google-auth-library';
import { TokenManager } from './tokenManager.js';
import http from 'http';
import { URL } from 'url';
import open from 'open';
import { loadCredentials } from './client.js';
import { getAccountMode, isNodeError } from './utils.js';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';
const PORT_RANGE = { start: 3500, end: 3505 };

function buildAuthHtml(title: string, body: string): string {
  return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${title}</title>
            </head>
            <body>
                ${body}
            </body>
            </html>`;
}
const AUTH_SERVER_TIMEOUT_MS = 10000;

export class AuthServer {
  private baseOAuth2Client: OAuth2Client; // Used by TokenManager for validation/refresh
  private flowOAuth2Client: OAuth2Client | null = null; // Used specifically for the auth code flow
  private server: http.Server | null = null;
  private tokenManager: TokenManager;
  private portRange: { start: number; end: number };
  private activeConnections: Set<import('net').Socket> = new Set(); // Track active socket connections
  public authCompletedSuccessfully = false; // Flag for standalone script

  constructor(oauth2Client: OAuth2Client) {
    this.baseOAuth2Client = oauth2Client;
    this.tokenManager = new TokenManager(oauth2Client);
    this.portRange = PORT_RANGE;
  }

  private createServer(): http.Server {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url || '/', `http://${req.headers.host}`);
      
      if (url.pathname === '/') {
        const clientForUrl = this.flowOAuth2Client || this.baseOAuth2Client;
        const authUrl = clientForUrl.generateAuthUrl({
          access_type: 'offline',
          scope: [CALENDAR_SCOPE],
          prompt: 'consent'
        });

        const accountMode = getAccountMode();

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <h1>Google Calendar Authentication</h1>
          <p><strong>Account Mode:</strong> <code>${accountMode}</code></p>
          <p>You are authenticating for the <strong>${accountMode}</strong> account.</p>
          <a href="${authUrl}">Authenticate with Google</a>
        `);
        
      } else if (url.pathname === '/oauth2callback') {
        // OAuth callback route
        const code = url.searchParams.get('code');
        if (!code) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end('Authorization code missing');
          return;
        }
        
        if (!this.flowOAuth2Client) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Authentication flow not properly initiated.');
          return;
        }
        
        try {
          const { tokens } = await this.flowOAuth2Client.getToken(code);
          await this.tokenManager.saveTokens(tokens);
          this.authCompletedSuccessfully = true;

          const tokenPath = this.tokenManager.getTokenPath();
          const accountMode = this.tokenManager.getAccountMode();

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(buildAuthHtml('Authentication Successful', `
                <h1>Authentication Successful!</h1>
                <p><strong>Account Mode:</strong> ${accountMode}</p>
                <p>Your authentication tokens have been saved for the <strong>${accountMode}</strong> account.</p>
                <p>Tokens saved to: ${tokenPath}</p>
                <p>You can now close this browser window.</p>
          `));
        } catch (error: unknown) {
          this.authCompletedSuccessfully = false;
          const message = error instanceof Error ? error.message : 'Unknown error';
          process.stderr.write(`✗ Token save failed: ${message}\n`);

          const escapedMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');

          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(buildAuthHtml('Authentication Failed', `
                <h1>Authentication Failed</h1>
                <p>An error occurred during authentication:</p>
                <p>${escapedMessage}</p>
                <p>Please try again or check the server logs.</p>
          `));
        }
      } else {
        // 404 for other routes
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    });

    // Track connections at server level
    server.on('connection', (socket) => {
      this.activeConnections.add(socket);
      socket.on('close', () => {
        this.activeConnections.delete(socket);
      });
    });
    
    return server;
  }

  async start(openBrowser = true): Promise<boolean> {
    return Promise.race([
      this.startWithTimeout(openBrowser),
      new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Auth server start timed out')), AUTH_SERVER_TIMEOUT_MS);
      })
    ]).catch(() => false);
  }

  private async startWithTimeout(openBrowser = true): Promise<boolean> {
    if (await this.tokenManager.isAuthenticated()) {
      this.authCompletedSuccessfully = true;
      return true;
    }
    
    // Try to start the server and get the port
    const port = await this.startServerOnAvailablePort();
    if (port === null) {
      this.authCompletedSuccessfully = false;
      return false;
    }

    // Successfully started server on `port`. Now create the flow-specific OAuth client.
    try {
      const { client_id, client_secret } = await loadCredentials();
      this.flowOAuth2Client = new OAuth2Client(
        client_id,
        client_secret,
        `http://localhost:${port}/oauth2callback`
      );
    } catch (error) {
        // Could not load credentials, cannot proceed with auth flow
        this.authCompletedSuccessfully = false;
        await this.stop(); // Stop the server we just started
        return false;
    }

    const authorizeUrl = this.flowOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [CALENDAR_SCOPE],
      prompt: 'consent'
    });
    
    // Always show the URL in console for easy access
    process.stderr.write(`\n🔗 Authentication URL: ${authorizeUrl}\n\n`);
    process.stderr.write(`Or visit: http://localhost:${port}\n\n`);
    
    if (openBrowser) {
      try {
        await open(authorizeUrl);
        process.stderr.write(`Browser opened automatically. If it didn't open, use the URL above.\n`);
      } catch (error) {
        process.stderr.write(`Could not open browser automatically. Please use the URL above.\n`);
      }
    } else {
      process.stderr.write(`Please visit the URL above to complete authentication.\n`);
    }

    return true; // Auth flow initiated
  }

  private async startServerOnAvailablePort(): Promise<number | null> {
    for (let port = this.portRange.start; port <= this.portRange.end; port++) {
      try {
        await new Promise<void>((resolve, reject) => {
          const testServer = this.createServer();
          testServer.listen(port, () => {
            this.server = testServer;
            resolve();
          });
          testServer.on('error', (err: NodeJS.ErrnoException) => {
            if (err.code === 'EADDRINUSE') {
              testServer.close(() => reject(err));
            } else {
              reject(err);
            }
          });
        });
        return port;
      } catch (error: unknown) {
        if (!isNodeError(error, 'EADDRINUSE')) {
          return null;
        }
      }
    }
    return null;
  }

  public getRunningPort(): number | null {
    if (this.server) {
      const address = this.server.address();
      if (typeof address === 'object' && address !== null) {
        return address.port;
      }
    }
    return null;
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.server) {
        // Force close all active connections
        for (const connection of this.activeConnections) {
          connection.destroy();
        }
        this.activeConnections.clear();
        
        // Add a timeout to force close if server doesn't close gracefully
        const timeout = setTimeout(() => {
          process.stderr.write('Server close timeout, forcing exit...\n');
          this.server = null;
          resolve();
        }, 2000); // 2 second timeout
        
        this.server.close((err) => {
          clearTimeout(timeout);
          if (err) {
            reject(err);
          } else {
            this.server = null;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
} 
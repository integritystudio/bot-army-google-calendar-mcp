import { OAuth2Client, Credentials } from 'google-auth-library';
import fs from 'fs/promises';
import { getSecureTokenPath, getAccountMode, getLegacyTokenPath, isNodeError, toErrorMessage } from './utils.js';
import { GaxiosError } from 'gaxios';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

interface MultiAccountTokens {
  normal?: Credentials;
  test?: Credentials;
}

export class TokenManager {
  private oauth2Client: OAuth2Client;
  private tokenPath: string;
  private accountMode: 'normal' | 'test';

  constructor(oauth2Client: OAuth2Client) {
    this.oauth2Client = oauth2Client;
    this.tokenPath = getSecureTokenPath();
    this.accountMode = getAccountMode();
    this.setupTokenRefresh();
  }

  public getTokenPath(): string {
    return this.tokenPath;
  }

  public getAccountMode(): 'normal' | 'test' {
    return this.accountMode;
  }

  public setAccountMode(mode: 'normal' | 'test'): void {
    this.accountMode = mode;
  }

  private async ensureTokenDirectoryExists(): Promise<void> {
    try {
      await mkdir(dirname(this.tokenPath), { recursive: true });
    } catch (error) {
      process.stderr.write(`Failed to create token directory: ${error}\n`);
    }
  }

  private async loadMultiAccountTokens(): Promise<MultiAccountTokens> {
    try {
      const fileContent = await fs.readFile(this.tokenPath, "utf-8");
      const parsed = JSON.parse(fileContent);

      if (parsed.access_token || parsed.refresh_token) {
        const multiAccountTokens: MultiAccountTokens = { normal: parsed };
        await this.saveMultiAccountTokens(multiAccountTokens);
        return multiAccountTokens;
      }

      return parsed as MultiAccountTokens;
    } catch (error: unknown) {
      if (isNodeError(error, 'ENOENT')) {
        return {};
      }
      throw error;
    }
  }

  private async saveMultiAccountTokens(multiAccountTokens: MultiAccountTokens): Promise<void> {
    await this.ensureTokenDirectoryExists();
    await fs.writeFile(this.tokenPath, JSON.stringify(multiAccountTokens, null, 2), {
      mode: 0o600,
    });
  }

  private setupTokenRefresh(): void {
    this.oauth2Client.on("tokens", async (newTokens) => {
      try {
        const multiAccountTokens = await this.loadMultiAccountTokens();
        const currentTokens = multiAccountTokens[this.accountMode] || {};

        const updatedTokens = {
          ...currentTokens,
          ...newTokens,
          refresh_token: newTokens.refresh_token || currentTokens.refresh_token,
        };

        multiAccountTokens[this.accountMode] = updatedTokens;
        await this.saveMultiAccountTokens(multiAccountTokens);

        if (process.env.NODE_ENV !== 'test') {
          process.stderr.write(`Tokens updated and saved for ${this.accountMode} account\n`);
        }
      } catch (error: unknown) {
        process.stderr.write(`Error saving tokens: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    });
  }

  private async migrateLegacyTokens(): Promise<boolean> {
    const legacyPath = getLegacyTokenPath();
    try {
      const legacyTokens = JSON.parse(await fs.readFile(legacyPath, "utf-8"));

      if (!legacyTokens || typeof legacyTokens !== "object") {
        process.stderr.write("Invalid legacy token format, skipping migration\n");
        return false;
      }

      await this.ensureTokenDirectoryExists();
      await fs.writeFile(this.tokenPath, JSON.stringify(legacyTokens, null, 2), {
        mode: 0o600,
      });

      process.stderr.write(`Migrated tokens from legacy location: ${legacyPath} to: ${this.tokenPath}\n`);

      try {
        await fs.unlink(legacyPath);
        process.stderr.write("Removed legacy token file\n");
      } catch (unlinkErr) {
        process.stderr.write(`Warning: Could not remove legacy token file: ${toErrorMessage(unlinkErr)}\n`);
      }

      return true;
    } catch (error: unknown) {
      if (isNodeError(error, 'ENOENT')) {
        return false;
      }
      process.stderr.write(`Error migrating legacy tokens: ${toErrorMessage(error)}\n`);
      return false;
    }
  }

  async loadSavedTokens(): Promise<boolean> {
    try {
      await this.ensureTokenDirectoryExists();

      const multiAccountTokens = await this.loadMultiAccountTokens();
      const tokens = multiAccountTokens[this.accountMode];

      if (!tokens || typeof tokens !== "object") {
        process.stderr.write(`No tokens found for ${this.accountMode} account in file: ${this.tokenPath}\n`);
        return false;
      }

      this.oauth2Client.setCredentials(tokens);
      process.stderr.write(`Loaded tokens for ${this.accountMode} account\n`);
      return true;
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        const migrated = await this.migrateLegacyTokens();
        if (migrated) {
          return this.loadSavedTokens();
        }
      }
      process.stderr.write(`Error loading tokens for ${this.accountMode} account: ${error instanceof Error ? error.message : String(error)}\n`);
      return false;
    }
  }

  async refreshTokensIfNeeded(): Promise<boolean> {
    const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
    const expiryDate = this.oauth2Client.credentials.expiry_date;
    const isExpired = expiryDate
      ? Date.now() >= expiryDate - TOKEN_REFRESH_BUFFER_MS
      : !this.oauth2Client.credentials.access_token;

    if (isExpired && this.oauth2Client.credentials.refresh_token) {
      if (process.env.NODE_ENV !== 'test') {
        process.stderr.write(`Auth token expired or nearing expiry for ${this.accountMode} account, refreshing...\n`);
      }
      try {
        const response = await this.oauth2Client.refreshAccessToken();
        const newTokens = response.credentials;

        if (!newTokens.access_token) {
          throw new Error("Received invalid tokens during refresh");
        }
        this.oauth2Client.setCredentials(newTokens);
        if (process.env.NODE_ENV !== 'test') {
          process.stderr.write(`Token refreshed successfully for ${this.accountMode} account\n`);
        }
        return true;
      } catch (refreshError) {
        if (refreshError instanceof GaxiosError && refreshError.response?.data?.error === 'invalid_grant') {
          process.stderr.write(`Error refreshing auth token for ${this.accountMode} account: Invalid grant. Token likely expired or revoked. Please re-authenticate.\n`);
          return false;
        }
        process.stderr.write(`Error refreshing auth token for ${this.accountMode} account: ${toErrorMessage(refreshError)}\n`);
        return false;
      }
    } else if (!this.oauth2Client.credentials.access_token && !this.oauth2Client.credentials.refresh_token) {
      process.stderr.write(`No access or refresh token available for ${this.accountMode} account. Please re-authenticate.\n`);
      return false;
    }

    return true;
  }

  async validateTokens(accountMode?: 'normal' | 'test'): Promise<boolean> {
    const modeToValidate = accountMode || this.accountMode;

    if (modeToValidate !== this.accountMode) {
      return this.switchAccount(modeToValidate);
    }

    if (!this.oauth2Client.credentials || !this.oauth2Client.credentials.access_token) {
      if (!(await this.loadSavedTokens())) {
        return false;
      }
      if (!this.oauth2Client.credentials || !this.oauth2Client.credentials.access_token) {
        return false;
      }
    }

    return this.refreshTokensIfNeeded();
  }

  async saveTokens(tokens: Credentials): Promise<void> {
    try {
      const multiAccountTokens = await this.loadMultiAccountTokens();
      multiAccountTokens[this.accountMode] = tokens;

      await this.saveMultiAccountTokens(multiAccountTokens);
      this.oauth2Client.setCredentials(tokens);
      process.stderr.write(`Tokens saved successfully for ${this.accountMode} account to: ${this.tokenPath}\n`);
    } catch (error: unknown) {
      process.stderr.write(`Error saving tokens for ${this.accountMode} account: ${toErrorMessage(error)}\n`);
      throw error;
    }
  }

  async clearTokens(): Promise<void> {
    try {
      this.oauth2Client.setCredentials({});

      const multiAccountTokens = await this.loadMultiAccountTokens();
      delete multiAccountTokens[this.accountMode];

      if (Object.keys(multiAccountTokens).length === 0) {
        await fs.unlink(this.tokenPath);
        process.stderr.write(`All tokens cleared, file deleted\n`);
      } else {
        await this.saveMultiAccountTokens(multiAccountTokens);
        process.stderr.write(`Tokens cleared for ${this.accountMode} account\n`);
      }
    } catch (error: unknown) {
      if (isNodeError(error, 'ENOENT')) {
        process.stderr.write("Token file already deleted\n");
      } else {
        process.stderr.write(`Error clearing tokens for ${this.accountMode} account: ${toErrorMessage(error)}\n`);
      }
    }
  }

  async listAvailableAccounts(): Promise<string[]> {
    try {
      const multiAccountTokens = await this.loadMultiAccountTokens();
      return Object.keys(multiAccountTokens);
    } catch (error) {
      return [];
    }
  }

  async switchAccount(newMode: 'normal' | 'test'): Promise<boolean> {
    this.accountMode = newMode;
    return this.loadSavedTokens();
  }
} 
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs/promises';
import { getKeysFilePath, generateCredentialsErrorMessage, OAuthCredentials, toErrorMessage } from './utils.js';

async function loadCredentialsFromFile(): Promise<OAuthCredentials> {
  const keysContent = await fs.readFile(getKeysFilePath(), "utf-8");
  const keys = JSON.parse(keysContent);

  if (keys.installed) {
    // Standard OAuth credentials file format
    const { client_id, client_secret, redirect_uris } = keys.installed;
    return { client_id, client_secret, redirect_uris };
  } else if (keys.client_id && keys.client_secret) {
    // Direct format
    return {
      client_id: keys.client_id,
      client_secret: keys.client_secret,
      redirect_uris: keys.redirect_uris || ['http://localhost:3000/oauth2callback']
    };
  } else {
    throw new Error('Invalid credentials file format. Expected either "installed" object or direct client_id/client_secret fields.');
  }
}

async function loadCredentialsWithFallback(): Promise<OAuthCredentials> {
  try {
    return await loadCredentialsFromFile();
  } catch (fileError) {
    const errorMessage = generateCredentialsErrorMessage();
    throw new Error(`${errorMessage}\n\nOriginal error: ${toErrorMessage(fileError)}`);
  }
}

export async function initializeOAuth2Client(): Promise<OAuth2Client> {
  try {
    const credentials = await loadCredentialsWithFallback();

    return new OAuth2Client({
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      redirectUri: credentials.redirect_uris[0],
    });
  } catch (error) {
    throw new Error(`Error loading OAuth keys: ${toErrorMessage(error)}`);
  }
}

export async function loadCredentials(): Promise<{ client_id: string; client_secret: string }> {
  try {
    const credentials = await loadCredentialsWithFallback();
    if (!credentials.client_id || !credentials.client_secret) {
      throw new Error('Client ID or Client Secret missing in credentials.');
    }
    return {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret
    };
  } catch (error) {
    throw new Error(`Error loading credentials: ${toErrorMessage(error)}`);
  }
}
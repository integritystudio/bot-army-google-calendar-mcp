#!/usr/bin/env node

/**
 * Shared path utilities for token management
 * This module provides consistent token path resolution across all scripts
 */

import path from 'path';
import { readFileSync } from 'fs';
import { homedir } from 'os';

const ACTIVE_ACCOUNT_FILE = path.join(homedir(), '.config/google-calendar-mcp', '.active-account');

/**
 * Get the secure token storage path
 * Priority: CALENDARMCP_TOKEN_PATH > XDG_CONFIG_HOME > default ~/.config
 */
export function getSecureTokenPath() {
  // Check for explicit token path override
  if (process.env.CALENDARMCP_TOKEN_PATH) {
    return process.env.CALENDARMCP_TOKEN_PATH;
  }

  const configDir = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  return path.join(configDir, 'google-calendar-mcp', 'tokens.json');
}

/**
 * Get the legacy token path (for migration purposes)
 */
export function getLegacyTokenPath() {
  return path.join(process.cwd(), '.gcp-saved-tokens.json');
}

/**
 * Get current account mode from environment or persisted selection.
 *
 * Resolution order:
 * 1. GOOGLE_ACCOUNT_MODE env var (any string)
 * 2. NODE_ENV === 'test' → 'test'
 * 3. ~/.config/google-calendar-mcp/.active-account file (set by switch-account.mjs)
 * 4. Default: 'normal'
 */
export function getAccountMode() {
  const explicitMode = process.env.GOOGLE_ACCOUNT_MODE?.toLowerCase();
  if (explicitMode) {
    return explicitMode;
  }

  if (process.env.NODE_ENV === 'test') {
    return 'test';
  }

  // Read persisted account selection from switch-account.mjs
  try {
    return readFileSync(ACTIVE_ACCOUNT_FILE, 'utf-8').trim();
  } catch {
    // File doesn't exist or unreadable
  }

  return 'normal';
}
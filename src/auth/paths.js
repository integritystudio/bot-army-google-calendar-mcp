#!/usr/bin/env node

/**
 * Shared path utilities for token management
 * This module provides consistent token path resolution across all scripts
 */

import path from 'path';
import { readFileSync } from 'fs';
import { homedir } from 'os';

const APP_DIR_NAME = 'google-calendar-mcp';
const GMAIL_TOKEN_FILE = 'tokens-gmail.json';
const ACTIVE_ACCOUNT_FILE_NAME = '.active-account';

/** ~/.config/google-calendar-mcp, or the XDG equivalent. */
function configDir() {
  const base = process.env.XDG_CONFIG_HOME || path.join(homedir(), '.config');
  return path.join(base, APP_DIR_NAME);
}

const ACTIVE_ACCOUNT_FILE = path.join(configDir(), ACTIVE_ACCOUNT_FILE_NAME);

/**
 * Get the secure token storage path
 * Priority: CALENDARMCP_TOKEN_PATH > XDG_CONFIG_HOME > default ~/.config
 */
export function getSecureTokenPath() {
  // Check for explicit token path override
  if (process.env.CALENDARMCP_TOKEN_PATH) {
    return process.env.CALENDARMCP_TOKEN_PATH;
  }

  return path.join(configDir(), 'tokens.json');
}

/**
 * Get the Gmail token storage path.
 *
 * The root .mjs Gmail scripts each hardcoded this, so the directory was written in three
 * places and honoured XDG_CONFIG_HOME in none of them. There is deliberately no
 * env override of its own: CALENDARMCP_TOKEN_PATH names the calendar token FILE, and
 * deriving a sibling from its dirname would relocate Gmail's tokens as a side effect of
 * moving the calendar's.
 */
export function getGmailTokenPath() {
  return path.join(configDir(), GMAIL_TOKEN_FILE);
}

/**
 * The file recording which account is active, written by switch-account.mjs and read by
 * getAccountMode below. It was defined here and again in switch-account.mjs; if the two
 * had ever drifted, switching an account would have silently stopped taking effect on
 * the calendar side.
 */
export function getActiveAccountFile() {
  return ACTIVE_ACCOUNT_FILE;
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
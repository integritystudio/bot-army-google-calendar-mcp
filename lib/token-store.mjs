/**
 * Read and write the multi-account OAuth token files.
 *
 * Both root Gmail scripts had their own copy: auth-gmail.mjs read the file, merged one
 * account in and wrote it back at 0600; switch-account.mjs did the same to delete an
 * account, plus its own tolerant read. The file layout — one JSON object keyed by
 * account mode — was therefore described in two places, as was the permission.
 *
 * Paths live in src/auth/paths.js, which is the calendar side's canonical answer and a
 * real .js file, so the .mjs scripts can import it directly rather than hardcoding a
 * third copy of the directory.
 */
import fs from 'fs/promises';
import path from 'path';

/** Token files hold credentials; only the owner may read them. */
const TOKEN_FILE_MODE = 0o600;
const JSON_INDENT = 2;

/**
 * Every account's tokens from one file, or {} when the file is absent or unreadable.
 *
 * Absent is the normal pre-auth state, so it is not an error — but this means a
 * malformed file also reads as empty, which is why callers report "not configured"
 * rather than "no tokens".
 *
 * @param {string} filePath
 * @returns {Promise<Record<string, object>>}
 */
export async function readAccountTokens(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

/**
 * Write the whole account map back at 0600, creating the directory if needed.
 *
 * @param {string} filePath
 * @param {Record<string, object>} tokens
 */
export async function writeAccountTokens(filePath, tokens) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(tokens, null, JSON_INDENT), { mode: TOKEN_FILE_MODE });
}

/**
 * Merge one account's tokens into the file, leaving every other account intact.
 *
 * Read-modify-write, not an overwrite: authenticating one account must not delete the
 * others, which is the whole reason the file is keyed by account.
 *
 * @param {string} filePath
 * @param {string} account
 * @param {object} tokens
 */
export async function saveAccountTokens(filePath, account, tokens) {
  const all = await readAccountTokens(filePath);
  all[account] = tokens;
  await writeAccountTokens(filePath, all);
}

/**
 * Human-readable expiry state for one account's tokens.
 *
 * @param {object} [tokens]
 * @returns {string}
 */
export function tokenStatus(tokens) {
  if (!tokens) return 'not configured';
  if (!tokens.expiry_date) return 'no expiry set';
  const expiry = new Date(tokens.expiry_date);
  if (expiry < new Date()) return `expired ${expiry.toLocaleDateString()}`;
  return `valid until ${expiry.toLocaleDateString()} ${expiry.toLocaleTimeString()}`;
}

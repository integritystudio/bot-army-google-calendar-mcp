/**
 * Switch between multiple OAuth accounts for Gmail and Calendar.
 *
 * Usage:
 *   node switch-account.mjs                # List all accounts and their status
 *   node switch-account.mjs <account>      # Switch to account (e.g. "alyshia" or "normal")
 *   node switch-account.mjs --add <name>   # Auth a new account with given name
 *   node switch-account.mjs --remove <name> # Remove an account's tokens
 */
import fs from 'fs/promises';
import path from 'path';
import { parseCli, runIfMain, fail } from './lib/cli-utils.mjs';
import { readAccountTokens, writeAccountTokens, tokenStatus } from './lib/token-store.mjs';
// The calendar side's canonical paths, imported rather than re-derived: this script used
// to hardcode the directory and so ignored CALENDARMCP_TOKEN_PATH and XDG_CONFIG_HOME,
// reporting "not configured" for tokens that were sitting where those pointed.
import { getSecureTokenPath, getGmailTokenPath, getActiveAccountFile } from './src/auth/paths.js';

const CALENDAR_TOKEN_PATH = getSecureTokenPath();
const GMAIL_TOKEN_PATH = getGmailTokenPath();
const ACCOUNT_ENV_FILE = getActiveAccountFile();
const ACCOUNT_FILE_MODE = 0o600;

async function listAccounts() {
  const calendarTokens = await readAccountTokens(CALENDAR_TOKEN_PATH);
  const gmailTokens = await readAccountTokens(GMAIL_TOKEN_PATH);

  const allAccounts = new Set([
    ...Object.keys(calendarTokens),
    ...Object.keys(gmailTokens),
  ]);

  let activeAccount;
  try {
    activeAccount = (await fs.readFile(ACCOUNT_ENV_FILE, 'utf-8')).trim();
  } catch {
    activeAccount = process.env.ACCOUNT_MODE || 'normal';
  }

  if (allAccounts.size === 0) {
    console.log('No accounts configured.');
    console.log('Run: node switch-account.mjs --add <name>');
    return;
  }

  console.log('\nConfigured accounts:\n');
  for (const account of [...allAccounts].sort()) {
    const marker = account === activeAccount ? ' (active)' : '';
    const cal = tokenStatus(calendarTokens[account]);
    const gmail = tokenStatus(gmailTokens[account]);
    console.log(`  ${account}${marker}`);
    console.log(`    Calendar: ${cal}`);
    console.log(`    Gmail:    ${gmail}`);
    console.log();
  }

  console.log(`Active account: ${activeAccount}`);
  console.log('Switch with: node switch-account.mjs <account-name>');
}

async function switchTo(accountName) {
  const calendarTokens = await readAccountTokens(CALENDAR_TOKEN_PATH);
  const gmailTokens = await readAccountTokens(GMAIL_TOKEN_PATH);

  const hasCalendar = accountName in calendarTokens;
  const hasGmail = accountName in gmailTokens;

  if (!hasCalendar && !hasGmail) {
    const available = [...new Set([
      ...Object.keys(calendarTokens),
      ...Object.keys(gmailTokens),
    ])].join(', ') || '(none)';
    fail(`Account "${accountName}" not found.\nAvailable: ${available}\n\n`
      + `To add a new account: node switch-account.mjs --add ${accountName}`);
  }

  await fs.mkdir(path.dirname(ACCOUNT_ENV_FILE), { recursive: true });
  await fs.writeFile(ACCOUNT_ENV_FILE, accountName, { mode: ACCOUNT_FILE_MODE });

  console.log(`Switched to account: ${accountName}`);
  if (hasCalendar) console.log(`  Calendar: ${tokenStatus(calendarTokens[accountName])}`);
  if (hasGmail) console.log(`  Gmail:    ${tokenStatus(gmailTokens[accountName])}`);
  if (!hasCalendar) console.log('  Calendar: not configured (run: npm run auth)');
  if (!hasGmail) console.log('  Gmail:    not configured (run: npm run auth:gmail)');

  console.log(`\nSet in your shell: export ACCOUNT_MODE=${accountName} GOOGLE_ACCOUNT_MODE=${accountName}`);
  console.log('  (Gmail .mjs reads ACCOUNT_MODE; calendar TS reads GOOGLE_ACCOUNT_MODE — set both.)');
}

async function addAccount(accountName) {
  console.log(`Adding account: ${accountName}\n`);
  // Each side reads a DIFFERENT env var (ACCOUNT_MODE for Gmail .mjs,
  // GOOGLE_ACCOUNT_MODE for the calendar TS) — the npm scripts below set the correct
  // one, so prefer them over exporting a variable by hand.
  console.log('Step 1: Authenticate Gmail');
  console.log(`  ACCOUNT_MODE=${accountName} npm run auth:gmail\n`);
  console.log('Step 2: Authenticate Calendar');
  console.log(`  GOOGLE_ACCOUNT_MODE=${accountName} npm run auth\n`);
  console.log('Step 3: Switch to the new account');
  console.log(`  node switch-account.mjs ${accountName}`);

  // Pre-create the active account file so switch works after auth
  await fs.mkdir(path.dirname(ACCOUNT_ENV_FILE), { recursive: true });
  await fs.writeFile(ACCOUNT_ENV_FILE, accountName, { mode: ACCOUNT_FILE_MODE });
  console.log(`\nActive account set to: ${accountName}`);
}

async function removeAccount(accountName) {
  const calendarTokens = await readAccountTokens(CALENDAR_TOKEN_PATH);
  const gmailTokens = await readAccountTokens(GMAIL_TOKEN_PATH);

  let removed = false;

  if (accountName in calendarTokens) {
    delete calendarTokens[accountName];
    await writeAccountTokens(CALENDAR_TOKEN_PATH, calendarTokens);
    console.log(`Removed Calendar tokens for: ${accountName}`);
    removed = true;
  }

  if (accountName in gmailTokens) {
    delete gmailTokens[accountName];
    await writeAccountTokens(GMAIL_TOKEN_PATH, gmailTokens);
    console.log(`Removed Gmail tokens for: ${accountName}`);
    removed = true;
  }

  if (!removed) fail(`Account "${accountName}" not found.`);
}

// CLI routing
const USAGE = 'Usage: node switch-account.mjs [account | --add <name> | --remove <name>]';

async function main() {
  const { values, positionals } = parseCli({
    add: { type: 'string' },
    remove: { type: 'string' },
  }, USAGE, { allowPositionals: true });

  if (values.add) return addAccount(values.add);
  if (values.remove) return removeAccount(values.remove);
  if (positionals.length > 0) return switchTo(positionals[0]);
  return listAccounts();
}

runIfMain(import.meta.url, main);

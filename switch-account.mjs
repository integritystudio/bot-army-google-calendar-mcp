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
import { homedir } from 'os';
import { parseCli } from './lib/cli-utils.mjs';

const TOKEN_DIR = path.join(homedir(), '.config/google-calendar-mcp');
const CALENDAR_TOKEN_PATH = path.join(TOKEN_DIR, 'tokens.json');
const GMAIL_TOKEN_PATH = path.join(TOKEN_DIR, 'tokens-gmail.json');

const ACCOUNT_ENV_FILE = path.join(TOKEN_DIR, '.active-account');

async function readJsonSafe(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function tokenStatus(tokens) {
  if (!tokens) return 'not configured';
  if (!tokens.expiry_date) return 'no expiry set';
  const expiry = new Date(tokens.expiry_date);
  const now = new Date();
  if (expiry < now) return `expired ${expiry.toLocaleDateString()}`;
  return `valid until ${expiry.toLocaleDateString()} ${expiry.toLocaleTimeString()}`;
}

async function listAccounts() {
  const calendarTokens = await readJsonSafe(CALENDAR_TOKEN_PATH);
  const gmailTokens = await readJsonSafe(GMAIL_TOKEN_PATH);

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
  const calendarTokens = await readJsonSafe(CALENDAR_TOKEN_PATH);
  const gmailTokens = await readJsonSafe(GMAIL_TOKEN_PATH);

  const hasCalendar = accountName in calendarTokens;
  const hasGmail = accountName in gmailTokens;

  if (!hasCalendar && !hasGmail) {
    console.error(`Account "${accountName}" not found.`);
    console.error('Available:', [...new Set([
      ...Object.keys(calendarTokens),
      ...Object.keys(gmailTokens),
    ])].join(', ') || '(none)');
    console.error('\nTo add a new account: node switch-account.mjs --add ' + accountName);
    process.exit(1);
  }

  await fs.mkdir(TOKEN_DIR, { recursive: true });
  await fs.writeFile(ACCOUNT_ENV_FILE, accountName, { mode: 0o600 });

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
  await fs.mkdir(TOKEN_DIR, { recursive: true });
  await fs.writeFile(ACCOUNT_ENV_FILE, accountName, { mode: 0o600 });
  console.log(`\nActive account set to: ${accountName}`);
}

async function removeAccount(accountName) {
  const calendarTokens = await readJsonSafe(CALENDAR_TOKEN_PATH);
  const gmailTokens = await readJsonSafe(GMAIL_TOKEN_PATH);

  let removed = false;

  if (accountName in calendarTokens) {
    delete calendarTokens[accountName];
    await writeJson(CALENDAR_TOKEN_PATH, calendarTokens);
    console.log(`Removed Calendar tokens for: ${accountName}`);
    removed = true;
  }

  if (accountName in gmailTokens) {
    delete gmailTokens[accountName];
    await writeJson(GMAIL_TOKEN_PATH, gmailTokens);
    console.log(`Removed Gmail tokens for: ${accountName}`);
    removed = true;
  }

  if (!removed) {
    console.error(`Account "${accountName}" not found.`);
    process.exit(1);
  }
}

// CLI routing
const USAGE = 'Usage: node switch-account.mjs [account | --add <name> | --remove <name>]';

const { values, positionals } = parseCli({
  add: { type: 'string' },
  remove: { type: 'string' },
}, USAGE, { allowPositionals: true });

if (values.add) {
  await addAccount(values.add);
} else if (values.remove) {
  await removeAccount(values.remove);
} else if (positionals.length > 0) {
  await switchTo(positionals[0]);
} else {
  await listAccounts();
}

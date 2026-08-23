import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
// @ts-expect-error - plain .mjs utility with no type declarations
import { readAccountTokens, writeAccountTokens, saveAccountTokens, tokenStatus } from '../../../../lib/token-store.mjs';

const OWNER_ONLY = 0o600;

let dir: string;
let tokenPath: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'token-store-'));
  tokenPath = join(dir, 'tokens-gmail.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('readAccountTokens', () => {
  it('reads the account map back', async () => {
    await writeFile(tokenPath, JSON.stringify({ normal: { access_token: 'a' } }));
    expect(await readAccountTokens(tokenPath)).toEqual({ normal: { access_token: 'a' } });
  });

  // Absent is the normal pre-auth state, so callers report "not configured".
  it('returns an empty map when the file does not exist', async () => {
    expect(await readAccountTokens(join(dir, 'nope.json'))).toEqual({});
  });

  it('returns an empty map for a malformed file rather than throwing', async () => {
    await writeFile(tokenPath, '{ this is not json');
    expect(await readAccountTokens(tokenPath)).toEqual({});
  });
});

describe('saveAccountTokens', () => {
  // The file is keyed by account precisely so authenticating one does not sign the
  // others out; an overwrite here would silently delete them.
  it('leaves every other account intact', async () => {
    await writeFile(tokenPath, JSON.stringify({
      normal: { access_token: 'keep-me' },
      alyshia: { access_token: 'keep-me-too' },
    }));

    await saveAccountTokens(tokenPath, 'personal', { access_token: 'new' });

    expect(await readAccountTokens(tokenPath)).toEqual({
      normal: { access_token: 'keep-me' },
      alyshia: { access_token: 'keep-me-too' },
      personal: { access_token: 'new' },
    });
  });

  it('replaces the named account without touching the rest', async () => {
    await writeFile(tokenPath, JSON.stringify({
      normal: { access_token: 'old' },
      alyshia: { access_token: 'untouched' },
    }));

    await saveAccountTokens(tokenPath, 'normal', { access_token: 'fresh' });

    const all = await readAccountTokens(tokenPath);
    expect(all.normal).toEqual({ access_token: 'fresh' });
    expect(all.alyshia).toEqual({ access_token: 'untouched' });
  });

  it('creates the file when there is nothing to merge into', async () => {
    await saveAccountTokens(tokenPath, 'normal', { access_token: 'a' });
    expect(await readAccountTokens(tokenPath)).toEqual({ normal: { access_token: 'a' } });
  });

  // These files hold refresh tokens. A world-readable one is a credential leak.
  it('writes owner-only permissions', async () => {
    await saveAccountTokens(tokenPath, 'normal', { access_token: 'a' });
    expect((await stat(tokenPath)).mode & 0o777).toBe(OWNER_ONLY);
  });
});

describe('writeAccountTokens', () => {
  it('creates the containing directory', async () => {
    const nested = join(dir, 'a', 'b', 'tokens.json');
    await writeAccountTokens(nested, { normal: {} });
    expect(JSON.parse(await readFile(nested, 'utf-8'))).toEqual({ normal: {} });
  });
});

describe('tokenStatus', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('reports an absent account as not configured', () => {
    expect(tokenStatus(undefined)).toBe('not configured');
  });

  it('reports tokens with no expiry', () => {
    expect(tokenStatus({ access_token: 'a' })).toBe('no expiry set');
  });

  it('reports an expired token as expired', () => {
    expect(tokenStatus({ expiry_date: Date.now() - DAY_MS })).toMatch(/^expired /);
  });

  it('reports a live token as valid', () => {
    expect(tokenStatus({ expiry_date: Date.now() + DAY_MS })).toMatch(/^valid until /);
  });
});

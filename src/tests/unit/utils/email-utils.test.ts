import { describe, it, expect } from 'vitest';
// @ts-expect-error - plain .mjs utility with no type declarations
import { shareLeadingToken, looksLikePlatform } from '../../../../lib/email-utils.mjs';

describe('shareLeadingToken', () => {
  it.each([
    [['Marriott Bonvoy', 'Marriott Rewards'], true],
    [['Airbnb', 'CVS Health'], false],
    [['Axios Austin', 'Axios | Pro'], true],
    [['Solo Sender'], true],
    [[], false],
  ])('%j -> %s', (names: string[], expected: boolean) => {
    expect(shareLeadingToken(names)).toBe(expected);
  });
});

describe('looksLikePlatform', () => {
  // One name is one org, however it signs itself.
  it('is false for a single display name', () => {
    expect(looksLikePlatform(['Airbnb'])).toBe(false);
  });

  // The failure this guards: express.medallia.com carries 20 organizations, and tagging
  // it by domain files all of their mail under the ESP's name.
  it('is true for several unrelated names on one domain', () => {
    expect(looksLikePlatform(['Airbnb', 'CVS Health', 'The Ritz-Carlton'])).toBe(true);
  });

  // One brand's variations are not a platform.
  it('is false when the names share a leading token', () => {
    expect(looksLikePlatform(['Marriott Bonvoy', 'Marriott Rewards', 'Marriott'])).toBe(false);
  });

  it('is false for no names at all', () => {
    expect(looksLikePlatform([])).toBe(false);
  });
});

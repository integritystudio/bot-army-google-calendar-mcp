/**
 * Returns the argv value following a flag, or null if the flag is absent.
 *
 * @param {string} flag - CLI flag (e.g. '--only')
 * @returns {string|null}
 */
export const argAfter = flag => {
  const i = process.argv.indexOf(flag);
  return i !== -1 && i + 1 < process.argv.length ? process.argv[i + 1] : null;
};

/**
 * True when a boolean flag is present in argv.
 *
 * @param {string} flag - CLI flag (e.g. '--dry-run')
 * @returns {boolean}
 */
export const hasFlag = flag => process.argv.includes(flag);

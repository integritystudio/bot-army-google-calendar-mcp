/**
 * CLI plumbing shared by the root scripts.
 *
 * Every script had hand-rolled the same three shapes — parse-or-print-usage,
 * validate-or-print-usage, and the main-module guard around an error-reporting
 * entrypoint. jscpd counted 18 clone pairs across the root .mjs files, and all
 * 18 were one of those three.
 *
 * Keeping them here also keeps them consistent: a script that printed the parse
 * error without the usage line, or exited 0 on a missing required flag, was a
 * difference nobody intended.
 */
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

/**
 * Print an optional message, then the usage line, and fail.
 *
 * Never returns. parseCli below still writes `return exitWithUsage(...)` so that every
 * path out of it is a return statement — a bare call would leave a path returning
 * undefined, which is what the destructuring caller would then blame.
 *
 * @returns {never}
 */
export function exitWithUsage(usage, message) {
  if (message) console.error(message);
  console.error(usage);
  process.exit(1);
}

/**
 * parseArgs, reporting a bad flag as a usage error instead of a stack trace.
 *
 * @param {Record<string, {type: 'string'|'boolean', default?: unknown}>} options
 * @param {string} usage - Printed on a parse failure
 * @param {{allowPositionals?: boolean}} [config]
 * @returns {{values: Record<string, any>, positionals: string[]}}
 */
export function parseCli(options, usage, { allowPositionals = false } = {}) {
  try {
    return parseArgs({ options, allowPositionals });
  } catch (error) {
    return exitWithUsage(usage, error.message);
  }
}

/**
 * Print a message to stderr and exit 1 — for a precondition check in main() itself
 * (missing label, missing account), as opposed to a library function's `throw`, which
 * runMain below already reports the same way. Four scripts had hand-rolled this, two
 * of them printing the failure via console.log — indistinguishable from normal output
 * to a caller piping stdout separately from stderr.
 *
 * @returns {never}
 */
export function fail(message) {
  console.error(message);
  process.exit(1);
}

/** True when this module was run directly rather than imported. */
export function isMainModule(moduleUrl) {
  return Boolean(process.argv[1]) && moduleUrl === pathToFileURL(process.argv[1]).href;
}

/**
 * Run an entrypoint, reporting a failure as one line rather than a stack trace.
 *
 * Invoked through Promise.resolve().then so a synchronous main (build-jsonld's) is
 * handled the same way as an async one — `main().catch(…)` would throw on the
 * undefined a sync function returns.
 */
export function runMain(main) {
  Promise.resolve().then(main).catch((error) => {
    console.error('Error:', error?.message ?? String(error));
    process.exit(1);
  });
}

/**
 * Run an async entrypoint only when this module is the process entry, so importing
 * the script (a preset reusing its exports, or a test) does not execute its CLI.
 */
export function runIfMain(moduleUrl, main) {
  if (isMainModule(moduleUrl)) runMain(main);
}

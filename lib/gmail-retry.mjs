/**
 * Retry policy for transient Gmail API failures.
 *
 * The implementation moved to src/shared/gmail-core.ts so the MCP handlers and these
 * scripts share one policy. This module stays as the import path six callers already
 * use, and because a lib module importing it from a feature module is the kind of edge
 * that turns into an import cycle.
 */
export { withRetry } from '../src/shared/gmail-core.ts';

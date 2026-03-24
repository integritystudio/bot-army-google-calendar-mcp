/**
 * Error response formatting utilities for consistent error handling
 */

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Format an error message from various error types
 * @param error - Error instance, string, or any value
 * @returns Formatted error string suitable for display
 */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as any).message === 'string') {
      return (error as any).message;
    }
    if ('error' in error && typeof (error as any).error === 'string') {
      return (error as any).error;
    }
  }
  return String(error || 'Unknown error');
}

/**
 * Build an error response for tool execution
 * @param message - Error message
 * @param details - Optional additional error details
 * @returns CallToolResult with error content
 */
export function buildErrorResponse(message: string, details?: Record<string, unknown>): CallToolResult {
  const text = details
    ? `${message}\n\nDetails: ${JSON.stringify(details, null, 2)}`
    : message;

  return {
    content: [{
      type: 'text',
      text
    }],
    isError: true
  };
}

/**
 * Handle and format API errors with context
 * @param error - Error from API call
 * @param context - Additional context (e.g., "fetching events", "creating calendar")
 * @returns Formatted error message
 */
export function formatApiError(error: unknown, context?: string): string {
  const message = formatErrorMessage(error);
  const contextPrefix = context ? `Error while ${context}: ` : 'API Error: ';
  return contextPrefix + message;
}

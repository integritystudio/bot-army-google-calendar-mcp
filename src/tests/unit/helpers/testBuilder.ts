/**
 * Generic test builder factory for creating objects with defaults and overrides
 */

export interface Builder<T> {
  /**
   * Create an instance with optional overrides
   */
  build(overrides?: Partial<T>): T;
  /**
   * Create multiple instances with per-instance overrides
   */
  buildMany(count: number, variantFn?: (index: number) => Partial<T>): T[];
}

/**
 * Create a test builder factory with default values
 * @param defaults - Default values for the object
 * @returns Builder with build() and buildMany() methods
 *
 * Note: Uses shallow merge via spread syntax. Nested objects in overrides completely
 * replace defaults rather than merging deeply. For example, passing
 * `{ start: { dateTime: '...' } }` will replace the entire start object.
 *
 * @example
 * const eventBuilder = createBuilder({
 *   id: 'event1',
 *   summary: 'Test Event',
 *   start: { dateTime: '2025-01-15T10:00:00Z' }
 * });
 *
 * // Create single event with overrides
 * const event = eventBuilder.build({ summary: 'Updated' });
 *
 * // Create multiple events with variations
 * const events = eventBuilder.buildMany(3, (i) => ({
 *   summary: `Event ${i + 1}`
 * }));
 */
export function createBuilder<T>(defaults: T): Builder<T> {
  return {
    build(overrides?: Partial<T>): T {
      return {
        ...defaults,
        ...overrides
      };
    },

    buildMany(count: number, variantFn?: (index: number) => Partial<T>): T[] {
      return Array.from({ length: count }, (_, i) => {
        const variantOverrides = variantFn?.(i) ?? {};
        return {
          ...defaults,
          ...variantOverrides
        };
      });
    }
  };
}

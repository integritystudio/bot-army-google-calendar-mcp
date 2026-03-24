/**
 * Data aggregation utility functions for common reduce patterns
 */

/**
 * Sum values extracted from array items by a key function
 * @param items - Array of items to sum
 * @param keyFn - Function to extract numeric value from each item
 * @returns Sum of all extracted values
 *
 * @example
 * const events = [{duration: 60}, {duration: 30}, {duration: 45}];
 * const total = sumBy(events, e => e.duration); // 135
 */
export function sumBy<T>(items: T[], keyFn: (item: T) => number): number {
  return items.reduce((sum, item) => sum + keyFn(item), 0);
}

/**
 * Group array items by a key function
 * @param items - Array of items to group
 * @param keyFn - Function to extract grouping key from each item
 * @returns Object with keys mapping to arrays of items
 *
 * @example
 * const events = [
 *   {calendarId: 'work', summary: 'Meeting'},
 *   {calendarId: 'personal', summary: 'Gym'},
 *   {calendarId: 'work', summary: 'Review'}
 * ];
 * const grouped = groupBy(events, e => e.calendarId);
 * // { work: [{summary: 'Meeting'}, {summary: 'Review'}], personal: [...] }
 */
export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}

/**
 * Count occurrences of values extracted by a key function
 * @param items - Array of items to count
 * @param keyFn - Function to extract countable key from each item
 * @returns Object with keys mapping to occurrence counts
 *
 * @example
 * const events = [
 *   {status: 'confirmed'},
 *   {status: 'tentative'},
 *   {status: 'confirmed'}
 * ];
 * const counts = countBy(events, e => e.status);
 * // { confirmed: 2, tentative: 1 }
 */
export function countBy<T>(items: T[], keyFn: (item: T) => string): Record<string, number> {
  return items.reduce((counts, item) => {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {} as Record<string, number>);
}

/**
 * Create a map of items indexed by a key function
 * @param items - Array of items to index
 * @param keyFn - Function to extract unique key from each item
 * @returns Map with keys mapping to items
 *
 * @example
 * const events = [{id: '1', summary: 'Meeting'}, {id: '2', summary: 'Gym'}];
 * const indexed = indexBy(events, e => e.id);
 * // { '1': {id: '1', summary: 'Meeting'}, '2': {...} }
 */
export function indexBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T> {
  return items.reduce((index, item) => {
    const key = keyFn(item);
    index[key] = item;
    return index;
  }, {} as Record<string, T>);
}

/**
 * Extract unique values from array by a key function
 * @param items - Array of items
 * @param keyFn - Function to extract value from each item
 * @returns Array of unique extracted values
 *
 * @example
 * const events = [
 *   {calendarId: 'work'},
 *   {calendarId: 'personal'},
 *   {calendarId: 'work'}
 * ];
 * const calendars = uniqBy(events, e => e.calendarId);
 * // ['work', 'personal']
 */
export function uniqBy<T, K>(items: T[], keyFn: (item: T) => K): K[] {
  const seen = new Set<K>();
  const result: K[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(key);
    }
  }

  return result;
}

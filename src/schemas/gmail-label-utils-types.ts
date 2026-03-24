import { z } from 'zod';

/**
 * Label pattern for batch application to emails
 */
export const LabelPatternSchema = z.object({
  label: z.string().min(1),
  query: z.string().min(1),
});

export type LabelPattern = z.infer<typeof LabelPatternSchema>;

/**
 * Batch of label patterns
 */
export const LabelPatternsSchema = z.array(LabelPatternSchema);

export type LabelPatterns = z.infer<typeof LabelPatternsSchema>;

/**
 * Label ID mapping object (key: label name, value: label ID)
 */
export const LabelIdMapSchema = z.record(z.string(), z.string());

export type LabelIdMap = z.infer<typeof LabelIdMapSchema>;

/**
 * Label cache (Map structure for efficient lookups)
 */
export const LabelCacheSchema = z.instanceof(Map);

export type LabelCache = Map<string, string>;

/**
 * Label creation result entry
 */
export const LabelCreationResultSchema = z.object({
  name: z.string(),
  id: z.string(),
});

export type LabelCreationResult = z.infer<typeof LabelCreationResultSchema>;

/**
 * Batch pattern application statistics
 */
export const PatternApplicationStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  pattern: z.string(),
  count: z.number().int().nonnegative(),
});

export type PatternApplicationStats = z.infer<typeof PatternApplicationStatsSchema>;

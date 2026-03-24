import { z } from 'zod';

/**
 * Email message object for categorization
 */
export const EmailMessageSchema = z.object({
  subject: z.string(),
  from: z.string(),
  snippet: z.string(),
});

export type EmailMessage = z.infer<typeof EmailMessageSchema>;

/**
 * Email categorization result
 */
export const EmailCategorySchema = z.object({
  urgency: z.enum(['High', 'Medium', 'Low']),
  importance: z.enum(['High', 'Medium', 'Low']),
});

export type EmailCategory = z.infer<typeof EmailCategorySchema>;

/**
 * Print section display configuration
 */
export const PrintSectionConfigSchema = z.object({
  fromMax: z.number().int().positive().default(45),
  subjectMax: z.number().int().positive().default(60),
  snippetMax: z.number().int().positive().default(65),
}).strict();

export type PrintSectionConfig = z.infer<typeof PrintSectionConfigSchema>;

/**
 * Email subsection for display
 */
export const EmailSubsectionSchema = z.object({
  label: z.string(),
  emails: z.array(EmailMessageSchema),
  limit: z.number().int().positive().optional(),
  count: z.boolean().optional(),
});

export type EmailSubsection = z.infer<typeof EmailSubsectionSchema>;

/**
 * Analyzer configuration with thresholds and keywords
 */
export const AnalyzerConfigSchema = z.object({
  DEFAULT_SCORE: z.number().int(),
  HIGH_SCORE: z.number().int(),
  LOW_SCORE: z.number().int(),
  HIGH_THRESHOLD: z.number().int(),
  LOW_THRESHOLD: z.number().int(),
  SECTION_DIVIDER: z.string(),
  ROW_DIVIDER: z.string(),
  HIGH_URGENCY_KEYWORDS: z.array(z.string()),
  LOW_URGENCY_KEYWORDS: z.array(z.string()),
  HIGH_IMPORTANCE_KEYWORDS: z.array(z.string()),
  LOW_IMPORTANCE_KEYWORDS: z.array(z.string()),
}).strict();

export type AnalyzerConfig = z.infer<typeof AnalyzerConfigSchema>;

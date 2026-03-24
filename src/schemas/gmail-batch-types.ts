import { z } from 'zod';

/**
 * Filter criteria for Gmail filter definitions
 */
export const FilterCriteriaSchema = z.object({
  query: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  subject: z.string().optional(),
  hasAttachment: z.boolean().optional(),
}).strict();

export type FilterCriteria = z.infer<typeof FilterCriteriaSchema>;

/**
 * Filter action for Gmail filter definitions
 */
export const FilterActionSchema = z.object({
  addLabelIds: z.array(z.string()).optional(),
  removeLabelIds: z.array(z.string()).optional(),
  archive: z.boolean().optional(),
  markAsRead: z.boolean().optional(),
  markAsSpam: z.boolean().optional(),
  markAsTrash: z.boolean().optional(),
  skip: z.boolean().optional(),
}).strict();

export type FilterAction = z.infer<typeof FilterActionSchema>;

/**
 * Gmail filter definition for creation
 */
export const FilterDefinitionSchema = z.object({
  criteria: FilterCriteriaSchema,
  action: FilterActionSchema,
});

export type FilterDefinition = z.infer<typeof FilterDefinitionSchema>;

/**
 * Array of filter definitions
 */
export const FilterDefinitionsSchema = z.array(FilterDefinitionSchema);

export type FilterDefinitions = z.infer<typeof FilterDefinitionsSchema>;

/**
 * Response from a single filter creation attempt
 */
export const FilterResponseSchema = z.object({
  success: z.boolean(),
  filterId: z.string().nullable(),
  error: z.string().nullable(),
});

export type FilterResponse = z.infer<typeof FilterResponseSchema>;

/**
 * Array of filter responses (one per input filter)
 */
export const FilterResponsesSchema = z.array(FilterResponseSchema);

export type FilterResponses = z.infer<typeof FilterResponsesSchema>;

/**
 * Summary of batch filter creation results
 */
export const BatchSummarySchema = z.object({
  successful: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  results: FilterResponsesSchema,
});

export type BatchSummary = z.infer<typeof BatchSummarySchema>;

/**
 * Zod schemas for email and Gmail operations
 * Type-safe validation for library functions
 */

// Email analyzer schemas
export {
  EmailMessageSchema,
  type EmailMessage,
  EmailCategorySchema,
  type EmailCategory,
  PrintSectionConfigSchema,
  type PrintSectionConfig,
  EmailSubsectionSchema,
  type EmailSubsection,
  AnalyzerConfigSchema,
  type AnalyzerConfig
} from './email-analyzer-types.js';

// Gmail label utils schemas
export {
  LabelPatternSchema,
  type LabelPattern,
  LabelPatternsSchema,
  type LabelPatterns,
  LabelIdMapSchema,
  type LabelIdMap,
  LabelCacheSchema,
  type LabelCache,
  LabelCreationResultSchema,
  type LabelCreationResult,
  PatternApplicationStatsSchema,
  type PatternApplicationStats
} from './gmail-label-utils-types.js';

// Gmail batch schemas
export {
  FilterCriteriaSchema,
  type FilterCriteria,
  FilterActionSchema,
  type FilterAction,
  FilterDefinitionSchema,
  type FilterDefinition,
  FilterDefinitionsSchema,
  type FilterDefinitions,
  FilterResponseSchema,
  type FilterResponse,
  FilterResponsesSchema,
  type FilterResponses,
  BatchSummarySchema,
  type BatchSummary
} from './gmail-batch-types.js';

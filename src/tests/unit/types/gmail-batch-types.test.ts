import { describe, it, expect } from 'vitest';
import {
  FilterCriteriaSchema,
  FilterActionSchema,
  FilterDefinitionSchema,
  FilterDefinitionsSchema,
  FilterResponseSchema,
  FilterResponsesSchema,
  BatchSummarySchema
} from '../../../schemas/gmail-batch-types';

describe('gmail-batch types', () => {
  describe('FilterCriteriaSchema', () => {
    it('validates criteria with all fields', () => {
      const criteria = {
        query: 'from:example@gmail.com',
        from: 'example@gmail.com',
        to: 'me@gmail.com',
        subject: 'Project Update',
        hasAttachment: true
      };
      expect(FilterCriteriaSchema.parse(criteria)).toEqual(criteria);
    });

    it('validates criteria with single field', () => {
      const criteria = { query: 'from:test@example.com' };
      expect(FilterCriteriaSchema.parse(criteria)).toEqual(criteria);
    });

    it('accepts empty criteria', () => {
      expect(FilterCriteriaSchema.parse({})).toEqual({});
    });

    it('rejects extra fields (strict mode)', () => {
      expect(() =>
        FilterCriteriaSchema.parse({
          query: 'test',
          extraField: 'not allowed'
        })
      ).toThrow();
    });

    it('rejects non-boolean hasAttachment', () => {
      expect(() =>
        FilterCriteriaSchema.parse({
          hasAttachment: 'true' // Invalid: string instead of boolean
        })
      ).toThrow();
    });
  });

  describe('FilterActionSchema', () => {
    it('validates action with label IDs', () => {
      const action = {
        addLabelIds: ['Label_1', 'Label_2'],
        archive: true
      };
      expect(FilterActionSchema.parse(action)).toEqual(action);
    });

    it('validates action with multiple flags', () => {
      const action = {
        markAsRead: true,
        markAsSpam: false,
        skip: true
      };
      expect(FilterActionSchema.parse(action)).toEqual(action);
    });

    it('accepts empty action', () => {
      expect(FilterActionSchema.parse({})).toEqual({});
    });

    it('rejects non-array label IDs', () => {
      expect(() =>
        FilterActionSchema.parse({
          addLabelIds: 'Label_1' // Invalid: string instead of array
        })
      ).toThrow();
    });

    it('rejects non-string label IDs in array', () => {
      expect(() =>
        FilterActionSchema.parse({
          addLabelIds: [123, 'Label_1'] // Invalid: number in array
        })
      ).toThrow();
    });

    it('rejects extra fields (strict mode)', () => {
      expect(() =>
        FilterActionSchema.parse({
          archive: true,
          unknownAction: 'not allowed'
        })
      ).toThrow();
    });
  });

  describe('FilterDefinitionSchema', () => {
    it('validates complete filter definition', () => {
      const filter = {
        criteria: {
          from: 'newsletter@example.com'
        },
        action: {
          addLabelIds: ['Label_1'],
          archive: true
        }
      };
      expect(FilterDefinitionSchema.parse(filter)).toEqual(filter);
    });

    it('rejects missing criteria', () => {
      expect(() =>
        FilterDefinitionSchema.parse({
          action: { archive: true }
        })
      ).toThrow();
    });

    it('rejects missing action', () => {
      expect(() =>
        FilterDefinitionSchema.parse({
          criteria: { from: 'test@example.com' }
        })
      ).toThrow();
    });

    it('validates with empty criteria and action', () => {
      const filter = {
        criteria: {},
        action: {}
      };
      expect(FilterDefinitionSchema.parse(filter)).toEqual(filter);
    });
  });

  describe('FilterDefinitionsSchema', () => {
    it('validates array of filters', () => {
      const filters = [
        {
          criteria: { from: 'test1@example.com' },
          action: { archive: true }
        },
        {
          criteria: { subject: 'Newsletter' },
          action: { addLabelIds: ['Label_1'] }
        }
      ];
      expect(FilterDefinitionsSchema.parse(filters)).toEqual(filters);
    });

    it('accepts empty array', () => {
      expect(FilterDefinitionsSchema.parse([])).toEqual([]);
    });

    it('rejects non-array input', () => {
      expect(() =>
        FilterDefinitionsSchema.parse({
          criteria: {},
          action: {}
        })
      ).toThrow();
    });

    it('rejects array with invalid filters', () => {
      expect(() =>
        FilterDefinitionsSchema.parse([
          {
            criteria: { from: 'valid@example.com' },
            action: { archive: true }
          },
          {
            criteria: { from: 'invalid@example.com' }
            // missing action
          }
        ])
      ).toThrow();
    });
  });

  describe('FilterResponseSchema', () => {
    it('validates successful response', () => {
      const response = {
        success: true,
        filterId: 'filter_123',
        error: null
      };
      expect(FilterResponseSchema.parse(response)).toEqual(response);
    });

    it('validates failure response', () => {
      const response = {
        success: false,
        filterId: null,
        error: 'Filter already exists'
      };
      expect(FilterResponseSchema.parse(response)).toEqual(response);
    });

    it('rejects missing success', () => {
      expect(() =>
        FilterResponseSchema.parse({
          filterId: 'filter_123',
          error: null
        })
      ).toThrow();
    });

    it('rejects non-boolean success', () => {
      expect(() =>
        FilterResponseSchema.parse({
          success: 'true', // Invalid: string instead of boolean
          filterId: 'filter_123',
          error: null
        })
      ).toThrow();
    });
  });

  describe('FilterResponsesSchema', () => {
    it('validates array of responses', () => {
      const responses = [
        { success: true, filterId: 'f1', error: null },
        { success: false, filterId: null, error: 'Already exists' }
      ];
      expect(FilterResponsesSchema.parse(responses)).toEqual(responses);
    });

    it('accepts empty array', () => {
      expect(FilterResponsesSchema.parse([])).toEqual([]);
    });
  });

  describe('BatchSummarySchema', () => {
    it('validates complete summary', () => {
      const summary = {
        successful: 50,
        failed: 5,
        results: [
          { success: true, filterId: 'f1', error: null },
          { success: false, filterId: null, error: 'Failed' }
        ]
      };
      expect(BatchSummarySchema.parse(summary)).toEqual(summary);
    });

    it('validates with all successful', () => {
      const summary = {
        successful: 100,
        failed: 0,
        results: [
          { success: true, filterId: 'f1', error: null },
          { success: true, filterId: 'f2', error: null }
        ]
      };
      expect(BatchSummarySchema.parse(summary)).toEqual(summary);
    });

    it('validates with all failed', () => {
      const summary = {
        successful: 0,
        failed: 2,
        results: [
          { success: false, filterId: null, error: 'Error 1' },
          { success: false, filterId: null, error: 'Error 2' }
        ]
      };
      expect(BatchSummarySchema.parse(summary)).toEqual(summary);
    });

    it('rejects negative counts', () => {
      expect(() =>
        BatchSummarySchema.parse({
          successful: -1,
          failed: 5,
          results: []
        })
      ).toThrow();
    });

    it('rejects non-integer counts', () => {
      expect(() =>
        BatchSummarySchema.parse({
          successful: 50.5,
          failed: 5,
          results: []
        })
      ).toThrow();
    });

    it('rejects missing results array', () => {
      expect(() =>
        BatchSummarySchema.parse({
          successful: 50,
          failed: 5
        })
      ).toThrow();
    });
  });
});

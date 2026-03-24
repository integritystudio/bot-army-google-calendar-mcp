import { describe, it, expect } from 'vitest';
import {
  LabelPatternSchema,
  LabelPatternsSchema,
  LabelIdMapSchema,
  LabelCreationResultSchema,
  PatternApplicationStatsSchema
} from '../../../schemas/gmail-label-utils-types';

describe('gmail-label-utils types', () => {
  describe('LabelPatternSchema', () => {
    it('validates a valid label pattern', () => {
      const pattern = {
        label: 'Product Updates',
        query: 'from:google@example.com'
      };
      expect(LabelPatternSchema.parse(pattern)).toEqual(pattern);
    });

    it('accepts hierarchical label names', () => {
      const pattern = {
        label: 'Product/Updates/Google',
        query: 'from:google@example.com'
      };
      expect(LabelPatternSchema.parse(pattern)).toEqual(pattern);
    });

    it('rejects empty label', () => {
      expect(() =>
        LabelPatternSchema.parse({
          label: '',
          query: 'from:test@example.com'
        })
      ).toThrow();
    });

    it('rejects empty query', () => {
      expect(() =>
        LabelPatternSchema.parse({
          label: 'Test',
          query: ''
        })
      ).toThrow();
    });

    it('rejects missing fields', () => {
      expect(() =>
        LabelPatternSchema.parse({
          label: 'Test'
          // missing query
        })
      ).toThrow();
    });
  });

  describe('LabelPatternsSchema', () => {
    it('validates array of patterns', () => {
      const patterns = [
        { label: 'Updates', query: 'from:google' },
        { label: 'Billing', query: 'subject:invoice' }
      ];
      expect(LabelPatternsSchema.parse(patterns)).toEqual(patterns);
    });

    it('accepts empty array', () => {
      expect(LabelPatternsSchema.parse([])).toEqual([]);
    });

    it('rejects non-array input', () => {
      expect(() =>
        LabelPatternsSchema.parse({ label: 'Test', query: 'test' })
      ).toThrow();
    });

    it('rejects array with invalid patterns', () => {
      expect(() =>
        LabelPatternsSchema.parse([
          { label: 'Valid', query: 'valid' },
          { label: '', query: 'invalid' } // Invalid: empty label
        ])
      ).toThrow();
    });
  });

  describe('LabelIdMapSchema', () => {
    it('validates a label ID map', () => {
      const map = {
        'Product Updates': 'Label_1',
        'Billing': 'Label_2',
        'Product/Updates': 'Label_3'
      };
      expect(LabelIdMapSchema.parse(map)).toEqual(map);
    });

    it('accepts empty map', () => {
      expect(LabelIdMapSchema.parse({})).toEqual({});
    });

    it('rejects non-string values', () => {
      expect(() =>
        LabelIdMapSchema.parse({
          'Test': 123 // Invalid: number instead of string
        })
      ).toThrow();
    });

    it('rejects non-object input', () => {
      expect(() =>
        LabelIdMapSchema.parse('not an object')
      ).toThrow();
    });
  });

  describe('LabelCreationResultSchema', () => {
    it('validates a creation result', () => {
      const result = {
        name: 'Product Updates',
        id: 'Label_123abc'
      };
      expect(LabelCreationResultSchema.parse(result)).toEqual(result);
    });

    it('accepts hierarchical label names', () => {
      const result = {
        name: 'Product/Updates/Google',
        id: 'Label_456def'
      };
      expect(LabelCreationResultSchema.parse(result)).toEqual(result);
    });

    it('rejects missing name', () => {
      expect(() =>
        LabelCreationResultSchema.parse({
          id: 'Label_123'
        })
      ).toThrow();
    });

    it('rejects missing id', () => {
      expect(() =>
        LabelCreationResultSchema.parse({
          name: 'Test'
        })
      ).toThrow();
    });

    it('rejects non-string values', () => {
      expect(() =>
        LabelCreationResultSchema.parse({
          name: 'Test',
          id: 123 // Invalid: number
        })
      ).toThrow();
    });
  });

  describe('PatternApplicationStatsSchema', () => {
    it('validates valid statistics', () => {
      const stats = {
        total: 50,
        pattern: 'from:google@example.com',
        count: 25
      };
      expect(PatternApplicationStatsSchema.parse(stats)).toEqual(stats);
    });

    it('accepts zero values', () => {
      const stats = {
        total: 0,
        pattern: 'test query',
        count: 0
      };
      expect(PatternApplicationStatsSchema.parse(stats)).toEqual(stats);
    });

    it('rejects negative total', () => {
      expect(() =>
        PatternApplicationStatsSchema.parse({
          total: -10,
          pattern: 'test',
          count: 5
        })
      ).toThrow();
    });

    it('rejects negative count', () => {
      expect(() =>
        PatternApplicationStatsSchema.parse({
          total: 10,
          pattern: 'test',
          count: -5
        })
      ).toThrow();
    });

    it('rejects non-integer values', () => {
      expect(() =>
        PatternApplicationStatsSchema.parse({
          total: 10.5,
          pattern: 'test',
          count: 5
        })
      ).toThrow();
    });

    it('rejects missing fields', () => {
      expect(() =>
        PatternApplicationStatsSchema.parse({
          total: 10,
          pattern: 'test'
          // missing count
        })
      ).toThrow();
    });
  });
});

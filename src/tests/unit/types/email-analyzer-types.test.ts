import { describe, it, expect } from 'vitest';
import {
  EmailMessageSchema,
  EmailCategorySchema,
  PrintSectionConfigSchema,
  EmailSubsectionSchema,
  AnalyzerConfigSchema
} from '../../../schemas/email-analyzer-types';
import {
  ANALYZER_CONFIG_COMPLETE,
  ANALYZER_CONFIG_INVALID_KEYWORDS,
  ANALYZER_CONFIG_WITH_EXTRA
} from '../helpers/test-configs';

describe('email-analyzer types', () => {
  describe('EmailMessageSchema', () => {
    it('validates a valid email message', () => {
      const msg = {
        subject: 'Test Subject',
        from: 'sender@example.com',
        snippet: 'This is a test message'
      };
      expect(EmailMessageSchema.parse(msg)).toEqual(msg);
    });

    it('rejects missing required fields', () => {
      expect(() =>
        EmailMessageSchema.parse({ subject: 'Test' })
      ).toThrow();
    });

    it('rejects non-string values', () => {
      expect(() =>
        EmailMessageSchema.parse({
          subject: 'Test',
          from: 'sender@example.com',
          snippet: 123 // Invalid: number instead of string
        })
      ).toThrow();
    });
  });

  describe('EmailCategorySchema', () => {
    it('validates correct urgency and importance values', () => {
      const category = {
        urgency: 'High',
        importance: 'Medium'
      };
      expect(EmailCategorySchema.parse(category)).toEqual(category);
    });

    it('accepts all valid combinations', () => {
      const combinations = [
        { urgency: 'High', importance: 'High' },
        { urgency: 'Medium', importance: 'Low' },
        { urgency: 'Low', importance: 'Medium' }
      ];
      combinations.forEach(combo => {
        expect(EmailCategorySchema.parse(combo)).toEqual(combo);
      });
    });

    it('rejects invalid urgency values', () => {
      expect(() =>
        EmailCategorySchema.parse({
          urgency: 'Critical', // Invalid
          importance: 'High'
        })
      ).toThrow();
    });

    it('rejects invalid importance values', () => {
      expect(() =>
        EmailCategorySchema.parse({
          urgency: 'High',
          importance: 'Critical' // Invalid
        })
      ).toThrow();
    });
  });

  describe('PrintSectionConfigSchema', () => {
    it('validates config with all values', () => {
      const config = {
        fromMax: 50,
        subjectMax: 80,
        snippetMax: 100
      };
      expect(PrintSectionConfigSchema.parse(config)).toEqual(config);
    });

    it('uses default values when omitted', () => {
      const result = PrintSectionConfigSchema.parse({});
      expect(result).toEqual({
        fromMax: 45,
        subjectMax: 60,
        snippetMax: 65
      });
    });

    it('rejects negative values', () => {
      expect(() =>
        PrintSectionConfigSchema.parse({
          fromMax: -10,
          subjectMax: 60,
          snippetMax: 65
        })
      ).toThrow();
    });

    it('rejects zero values', () => {
      expect(() =>
        PrintSectionConfigSchema.parse({
          fromMax: 0,
          subjectMax: 60,
          snippetMax: 65
        })
      ).toThrow();
    });

    it('rejects non-integer values', () => {
      expect(() =>
        PrintSectionConfigSchema.parse({
          fromMax: 45.5,
          subjectMax: 60,
          snippetMax: 65
        })
      ).toThrow();
    });
  });

  describe('EmailSubsectionSchema', () => {
    it('validates a valid subsection', () => {
      const subsection = {
        label: 'Important Emails',
        emails: [
          {
            subject: 'Meeting',
            from: 'boss@company.com',
            snippet: 'Let\'s discuss the project'
          }
        ],
        limit: 10,
        count: false
      };
      expect(EmailSubsectionSchema.parse(subsection)).toEqual(subsection);
    });

    it('allows optional limit and count', () => {
      const subsection = {
        label: 'Newsletters',
        emails: []
      };
      expect(EmailSubsectionSchema.parse(subsection)).toEqual(subsection);
    });

    it('rejects missing label or emails', () => {
      expect(() =>
        EmailSubsectionSchema.parse({
          label: 'Test'
          // missing emails
        })
      ).toThrow();
    });

    it('validates emails array contains valid messages', () => {
      const subsection = {
        label: 'Test',
        emails: [
          {
            subject: 'Test',
            from: 'test@example.com',
            snippet: 'test'
          }
        ]
      };
      expect(EmailSubsectionSchema.parse(subsection)).toBeDefined();
    });
  });

  describe('AnalyzerConfigSchema', () => {
    it('validates a complete analyzer config', () => {
      expect(AnalyzerConfigSchema.parse(ANALYZER_CONFIG_COMPLETE)).toEqual(
        ANALYZER_CONFIG_COMPLETE
      );
    });

    it('rejects missing required fields', () => {
      const incomplete = {
        DEFAULT_SCORE: 5,
        HIGH_SCORE: 9
        // missing other fields
      };
      expect(() => AnalyzerConfigSchema.parse(incomplete)).toThrow();
    });

    it('rejects non-array keyword lists', () => {
      expect(() =>
        AnalyzerConfigSchema.parse(ANALYZER_CONFIG_INVALID_KEYWORDS)
      ).toThrow();
    });

    it('rejects extra fields (strict mode)', () => {
      expect(() =>
        AnalyzerConfigSchema.parse(ANALYZER_CONFIG_WITH_EXTRA)
      ).toThrow();
    });
  });
});

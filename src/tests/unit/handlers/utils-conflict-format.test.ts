import { describe, it, expect } from 'vitest';
import { formatConflictWarnings } from '../../../handlers/utils.js';
import { ConflictCheckResult } from '../../../services/conflict-detection/types.js';
import { makeEvent } from '../helpers/index.js';
import {
  CONFLICT_DETECTED_HEADER,
  CALENDAR_PREFIX,
  CONFLICTING_EVENT_HEADER,
  OVERLAP_PREFIX,
  CONFLICTING_EVENT_DETAILS_LABEL,
} from '../../../handlers/utils.js';

describe('Enhanced Conflict Response Formatting', () => {
  it('should format conflict warnings with full event details', () => {
    const conflictingEvent = makeEvent({
      id: 'conflict456',
      summary: 'Design Review',
      description: 'Q4 design review meeting',
      location: 'Room 201',
      start: { dateTime: '2024-01-15T13:30:00Z' },
      end: { dateTime: '2024-01-15T14:30:00Z' },
      htmlLink: 'https://calendar.google.com/event?eid=conflict456'
    });

    const conflicts: ConflictCheckResult = {
      hasConflicts: true,
      duplicates: [],
      conflicts: [{
        type: 'overlap',
        calendar: 'primary',
        event: {
          id: 'conflict456',
          title: 'Design Review',
          url: 'https://calendar.google.com/event?eid=conflict456',
          start: '2024-01-15T13:30:00Z',
          end: '2024-01-15T14:30:00Z'
        },
        fullEvent: conflictingEvent,
        overlap: {
          duration: '30 minutes',
          percentage: 50,
          startTime: '2024-01-15T13:30:00Z',
          endTime: '2024-01-15T14:00:00Z'
        }
      }]
    };

    const formatted = formatConflictWarnings(conflicts);
    
    expect(formatted).toContain(CONFLICT_DETECTED_HEADER);
    expect(formatted).toContain(`${CALENDAR_PREFIX}primary`);
    expect(formatted).toContain(CONFLICTING_EVENT_HEADER);
    expect(formatted).toContain(`${OVERLAP_PREFIX}30 minutes (50% of your event)`);
    expect(formatted).toContain(CONFLICTING_EVENT_DETAILS_LABEL);
    expect(formatted).toContain('Event: Design Review');
    expect(formatted).toContain('Description: Q4 design review meeting');
    expect(formatted).toContain('Location: Room 201');
  });

  it('should format multiple conflicts with proper separation', () => {
    const conflicts: ConflictCheckResult = {
      hasConflicts: true,
      duplicates: [],
      conflicts: [
        {
          type: 'overlap',
          calendar: 'work@company.com',
          event: {
            id: 'work1',
            title: 'Sprint Planning',
            url: 'https://calendar.google.com/event?eid=work1'
          },
          fullEvent: makeEvent({
            id: 'work1',
            summary: 'Sprint Planning',
            start: { dateTime: '2024-01-15T09:00:00Z' },
            end: { dateTime: '2024-01-15T10:00:00Z' }
          }),
          overlap: {
            duration: '15 minutes',
            percentage: 25,
            startTime: '2024-01-15T09:45:00Z',
            endTime: '2024-01-15T10:00:00Z'
          }
        },
        {
          type: 'overlap',
          calendar: 'work@company.com',
          event: {
            id: 'work2',
            title: 'Daily Standup',
            url: 'https://calendar.google.com/event?eid=work2'
          },
          overlap: {
            duration: '30 minutes',
            percentage: 100,
            startTime: '2024-01-15T10:00:00Z',
            endTime: '2024-01-15T10:30:00Z'
          }
        }
      ]
    };

    const formatted = formatConflictWarnings(conflicts);
    
    expect(formatted).toContain(`${CALENDAR_PREFIX}work@company.com`);
    expect(formatted.split(CONFLICTING_EVENT_HEADER).length - 1).toBe(2);
    expect(formatted).toContain('Sprint Planning');
    expect(formatted).toContain('Daily Standup');
    expect(formatted).toContain(`${OVERLAP_PREFIX}15 minutes (25% of your event)`);
    expect(formatted).toContain(`${OVERLAP_PREFIX}30 minutes (100% of your event)`);
  });
});
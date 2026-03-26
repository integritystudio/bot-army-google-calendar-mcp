import { calendar_v3 } from "googleapis";
import { EventTimeRange } from "./types.js";
import { EventSimilarityChecker } from "./EventSimilarityChecker.js";
import { durationMs, durationMinutes } from "../../utils/date-utils.js";

export class ConflictAnalyzer {
  private similarityChecker: EventSimilarityChecker;
  
  constructor() {
    this.similarityChecker = new EventSimilarityChecker();
  }
  /**
   * Analyze overlap between two events
   * Uses consolidated overlap logic from EventSimilarityChecker
   */
  analyzeOverlap(event1: calendar_v3.Schema$Event, event2: calendar_v3.Schema$Event): {
    hasOverlap: boolean;
    duration?: string;
    percentage?: number;
    startTime?: string;
    endTime?: string;
  } {
    // Use consolidated overlap check
    const hasOverlap = this.similarityChecker.eventsOverlap(event1, event2);
    
    if (!hasOverlap) {
      return { hasOverlap: false };
    }
    
    // Get time ranges for detailed analysis
    const time1 = this.getEventTimeRange(event1);
    const time2 = this.getEventTimeRange(event2);
    
    if (!time1 || !time2) {
      return { hasOverlap: false };
    }
    
    // Calculate overlap details
    const overlapDuration = this.similarityChecker.calculateOverlapDuration(event1, event2);
    const overlapStart = time1.start.getTime() > time2.start.getTime() ? time1.start : time2.start;
    const overlapEnd = time1.end.getTime() < time2.end.getTime() ? time1.end : time2.end;

    // Calculate percentage of overlap relative to the first event
    const event1Duration = durationMs(time1.start, time1.end);
    const overlapPercentage = Math.round((overlapDuration / event1Duration) * 100);
    
    return {
      hasOverlap: true,
      duration: this.formatDuration(overlapDuration),
      percentage: overlapPercentage,
      startTime: new Date(overlapStart.getTime()).toISOString(),
      endTime: new Date(overlapEnd.getTime()).toISOString()
    };
  }

  /**
   * Get event time range
   */
  private getEventTimeRange(event: calendar_v3.Schema$Event): EventTimeRange | null {
    const startTime = event.start?.dateTime || event.start?.date;
    const endTime = event.end?.dateTime || event.end?.date;
    
    if (!startTime || !endTime) return null;
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    // Check if it's an all-day event
    const isAllDay = !event.start?.dateTime && !!event.start?.date;
    
    return { start, end, isAllDay };
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(milliseconds: number): string {
    const baseDate = new Date(0);
    const endDate = new Date(milliseconds);

    const totalMinutes = durationMinutes(baseDate, endDate);
    const days = Math.floor(totalMinutes / (24 * 60));
    const remainingMinutes = totalMinutes % (24 * 60);
    const hours = Math.floor(remainingMinutes / 60);
    const mins = remainingMinutes % 60;

    if (days > 0) {
      return hours > 0
        ? `${days} day${days > 1 ? 's' : ''} ${hours} hour${hours > 1 ? 's' : ''}`
        : `${days} day${days > 1 ? 's' : ''}`;
    }

    if (hours > 0) {
      return mins > 0
        ? `${hours} hour${hours > 1 ? 's' : ''} ${mins} minute${mins > 1 ? 's' : ''}`
        : `${hours} hour${hours > 1 ? 's' : ''}`;
    }

    return `${mins} minute${mins > 1 ? 's' : ''}`;
  }

  /**
   * Check if an event conflicts with a busy time slot
   */
  checkBusyConflict(event: calendar_v3.Schema$Event, busySlot: { start?: string | null; end?: string | null }): boolean {
    // Handle null values from Google's API
    const start = busySlot.start ?? undefined;
    const end = busySlot.end ?? undefined;
    
    if (!start || !end) return false;
    
    // Convert busy slot to event format for consistency
    const busyEvent: calendar_v3.Schema$Event = {
      start: { dateTime: start },
      end: { dateTime: end }
    };
    
    return this.similarityChecker.eventsOverlap(event, busyEvent);
  }

  /**
   * Filter events that overlap with a given time range
   */
  findOverlappingEvents(
    events: calendar_v3.Schema$Event[],
    targetEvent: calendar_v3.Schema$Event
  ): calendar_v3.Schema$Event[] {
    return events.filter(event => {
      // Skip the same event
      if (event.id === targetEvent.id) return false;
      
      // Skip cancelled events
      if (event.status === 'cancelled') return false;
      
      // Use consolidated overlap check
      return this.similarityChecker.eventsOverlap(targetEvent, event);
    });
  }
}
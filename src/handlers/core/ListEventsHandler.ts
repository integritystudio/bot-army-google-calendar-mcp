import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { BatchRequestHandler } from "./BatchRequestHandler.js";
import { resolveTimeRange } from "../../utils/timezone-utils.js";
import { buildListFieldMask } from "../../utils/field-mask-builder.js";
import { processBatchResponses } from "./batchUtils.js";
import { formatEventsList } from "./eventFormatting.js";
import { ListEventsOptions, ExtendedEvent } from "./types.js";

interface ListEventsArgs {
  calendarId: string | string[];
  timeMin?: string;
  timeMax?: string;
  timeZone?: string;
  fields?: string[];
  privateExtendedProperty?: string[];
  sharedExtendedProperty?: string[];
}

export class ListEventsHandler extends BaseToolHandler {
    async runTool(args: ListEventsArgs, oauth2Client: OAuth2Client): Promise<CallToolResult> {
        const calendarIds = Array.isArray(args.calendarId)
            ? args.calendarId
            : [args.calendarId];

        const allEvents = await this.fetchEvents(oauth2Client, calendarIds, {
            timeMin: args.timeMin,
            timeMax: args.timeMax,
            timeZone: args.timeZone,
            fields: args.fields,
            privateExtendedProperty: args.privateExtendedProperty,
            sharedExtendedProperty: args.sharedExtendedProperty
        });

        if (allEvents.length === 0) {
            return this.textResult(`No events found in ${calendarIds.length} calendar(s).`);
        }

        const text = formatEventsList(allEvents, {
            groupByCalendar: calendarIds.length > 1
        });

        return this.textResult(text);
    }

    private async fetchEvents(
        client: OAuth2Client,
        calendarIds: string[],
        options: ListEventsOptions
    ): Promise<ExtendedEvent[]> {
        if (calendarIds.length === 1) {
            return this.fetchSingleCalendarEvents(client, calendarIds[0], options);
        }

        return this.fetchMultipleCalendarEvents(client, calendarIds, options);
    }

    private async fetchSingleCalendarEvents(
        client: OAuth2Client,
        calendarId: string,
        options: ListEventsOptions
    ): Promise<ExtendedEvent[]> {
        try {
            const calendar = this.getCalendar(client);

            let { timeMin, timeMax } = { timeMin: options.timeMin, timeMax: options.timeMax };
            if (timeMin || timeMax) {
                const timezone = options.timeZone || await this.getCalendarTimezone(client, calendarId);
                const resolved = resolveTimeRange(timeMin, timeMax, timezone);
                timeMin = resolved.timeMin;
                timeMax = resolved.timeMax;
            }

            const fieldMask = buildListFieldMask(options.fields);

            const response = await calendar.events.list({
                calendarId,
                timeMin,
                timeMax,
                singleEvents: true,
                orderBy: 'startTime',
                ...(fieldMask && { fields: fieldMask }),
                ...(options.privateExtendedProperty && { privateExtendedProperty: options.privateExtendedProperty }),
                ...(options.sharedExtendedProperty && { sharedExtendedProperty: options.sharedExtendedProperty })
            });

            return (response.data.items || []).map(event => ({
                ...event,
                calendarId
            }));
        } catch (error) {
            throw this.handleGoogleApiError(error);
        }
    }

    private async fetchMultipleCalendarEvents(
        client: OAuth2Client,
        calendarIds: string[],
        options: ListEventsOptions
    ): Promise<ExtendedEvent[]> {
        const batchHandler = new BatchRequestHandler(client);
        const fieldMask = buildListFieldMask(options.fields);

        // Batch timezone fetches to avoid N+1 API calls
        const timezones = await Promise.all(
            calendarIds.map(id =>
                options.timeZone ? Promise.resolve(options.timeZone) : this.getCalendarTimezone(client, id)
            )
        );

        const requests = calendarIds.map((calendarId, i) => ({
            method: "GET" as const,
            path: this.buildEventsPath(calendarId, timezones[i], options, fieldMask)
        }));

        const responses = await batchHandler.executeBatch(requests);
        const result = processBatchResponses(responses, calendarIds, { includeErrors: true });

        if (result.errors.length > 0) {
            process.stderr.write(`Some calendars had errors: ${result.errors.map(e => `${e.calendarId}: ${e.error}`).join(', ')}\n`);
        }

        return result.events;
    }

    private buildEventsPath(
        calendarId: string,
        timezone: string,
        options: ListEventsOptions,
        fieldMask: string | null
    ): string {
        const params = new URLSearchParams({
            singleEvents: "true",
            orderBy: "startTime",
        });

        if (options.timeMin || options.timeMax) {
            const { timeMin, timeMax } = resolveTimeRange(options.timeMin, options.timeMax, timezone);
            if (timeMin) params.set('timeMin', timeMin);
            if (timeMax) params.set('timeMax', timeMax);
        }

        if (fieldMask) params.set('fields', fieldMask);

        if (options.privateExtendedProperty) {
            for (const kv of options.privateExtendedProperty) {
                params.append('privateExtendedProperty', kv);
            }
        }

        if (options.sharedExtendedProperty) {
            for (const kv of options.sharedExtendedProperty) {
                params.append('sharedExtendedProperty', kv);
            }
        }

        return `/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    }

}

import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { OAuth2Client } from "google-auth-library";
import { BaseToolHandler } from "./BaseToolHandler.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { GetCurrentTimeInput } from "../../tools/registry.js";
import {
  isValidIANATimeZone,
  getSystemTimeZone,
  formatDateInTimeZone,
} from "../../utils/timezone-utils.js";

export class GetCurrentTimeHandler extends BaseToolHandler {
    async runTool(args: any, _oauth2Client: OAuth2Client): Promise<CallToolResult> {
        // Validate arguments using schema
        const validArgs = args as GetCurrentTimeInput;

        const now = new Date();

        // If no timezone provided, return UTC and system timezone info
        // This is safer for HTTP mode where server timezone may not match user
        const requestedTimeZone = validArgs.timeZone;
        const systemTimeZone = getSystemTimeZone();

        let result: any;

        if (requestedTimeZone) {
            // Validate the timezone
            if (!isValidIANATimeZone(requestedTimeZone)) {
                throw new McpError(
                    ErrorCode.InvalidRequest,
                    `Invalid timezone: ${requestedTimeZone}. Use IANA timezone format like 'America/Los_Angeles' or 'UTC'.`
                );
            }

            const formatted = formatDateInTimeZone(now, requestedTimeZone);
            result = {
                currentTime: {
                    utc: now.toISOString(),
                    timestamp: now.getTime(),
                    requestedTimeZone: {
                        timeZone: requestedTimeZone,
                        rfc3339: formatted.rfc3339,
                        humanReadable: formatted.humanReadable,
                        offset: formatted.offset
                    }
                }
            };
        } else {
            // No timezone requested - provide UTC and system info for reference
            const formatted = formatDateInTimeZone(now, systemTimeZone);
            result = {
                currentTime: {
                    utc: now.toISOString(),
                    timestamp: now.getTime(),
                    systemTimeZone: {
                        timeZone: systemTimeZone,
                        rfc3339: formatted.rfc3339,
                        humanReadable: formatted.humanReadable,
                        offset: formatted.offset
                    },
                    note: "System timezone shown. For HTTP mode, specify timeZone parameter for user's local time."
                }
            };
        }

        return {
            content: [{
                type: "text",
                text: JSON.stringify(result, null, 2),
            }],
        };
    }
}
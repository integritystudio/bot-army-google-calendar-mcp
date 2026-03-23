import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface GmailApplyFiltersInput {
  dryRun?: boolean;
}

export class GmailApplyFiltersHandler extends BaseToolHandler {
  async runTool(args: GmailApplyFiltersInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  async execute(input: GmailApplyFiltersInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const isDryRun = input.dryRun ?? false;

    try {
      // Get all filters
      const filtersResponse = await gmail.users.settings.filters.list({
        userId: "me",
      });

      const filters = filtersResponse.data.filter || [];

      if (filters.length === 0) {
        return {
          success: true,
          message: "No filters found",
          filtersApplied: 0,
          dryRun: isDryRun,
        };
      }

      const results = {
        success: true,
        dryRun: isDryRun,
        filtersProcessed: filters.length,
        appliedActions: [] as any[],
        errors: [] as any[],
      };

      for (const filter of filters) {
        try {
          const criteria = filter.criteria || {};
          const action = filter.action || {};

          // Build search query from criteria
          const searchQuery = buildSearchQuery(criteria);

          if (!searchQuery) {
            results.errors.push({
              filterId: filter.id,
              error: "Could not build search query from filter criteria",
            });
            continue;
          }

          // Search for matching messages
          const messagesResponse = await gmail.users.messages.list({
            userId: "me",
            q: searchQuery,
            maxResults: 500, // Process in batches of 500
          });

          const messages = messagesResponse.data.messages || [];

          if (messages.length === 0) {
            results.appliedActions.push({
              filterId: filter.id,
              criteria,
              action,
              matchedMessages: 0,
              summary: "No matching messages found",
              dryRun: isDryRun,
            });
            continue;
          }

          // Apply filter actions to matched messages
          let processed = 0;
          let failed = 0;

          for (const message of messages) {
            try {
              if (isDryRun) {
                processed++;
                continue;
              }

              const modifyRequest: any = {};

              // Add label IDs
              if (action.addLabelIds && action.addLabelIds.length > 0) {
                modifyRequest.addLabelIds = action.addLabelIds;
              }

              // Remove label IDs
              if (action.removeLabelIds && action.removeLabelIds.length > 0) {
                modifyRequest.removeLabelIds = action.removeLabelIds;
              }

              // Handle archive (skip inbox)
              const actionAny = action as any;
              if (actionAny.skip) {
                if (!modifyRequest.removeLabelIds) {
                  modifyRequest.removeLabelIds = [];
                }
                if (!modifyRequest.removeLabelIds.includes("INBOX")) {
                  modifyRequest.removeLabelIds.push("INBOX");
                }
              }

              // Handle mark as spam
              if (actionAny.markAsSpam) {
                if (!modifyRequest.addLabelIds) {
                  modifyRequest.addLabelIds = [];
                }
                if (!modifyRequest.addLabelIds.includes("SPAM")) {
                  modifyRequest.addLabelIds.push("SPAM");
                }
              }

              // Handle mark as trash
              if (actionAny.markAsTrash) {
                if (!modifyRequest.addLabelIds) {
                  modifyRequest.addLabelIds = [];
                }
                if (!modifyRequest.addLabelIds.includes("TRASH")) {
                  modifyRequest.addLabelIds.push("TRASH");
                }
              }

              if (Object.keys(modifyRequest).length > 0) {
                await gmail.users.messages.modify({
                  userId: "me",
                  id: message.id!,
                  requestBody: modifyRequest,
                });
                processed++;
              }
            } catch (error) {
              failed++;
            }
          }

          results.appliedActions.push({
            filterId: filter.id,
            criteria,
            action,
            matchedMessages: messages.length,
            processedMessages: processed,
            failedMessages: failed,
            summary: `Applied ${action.addLabelIds?.length || 0} add labels, ${action.removeLabelIds?.length || 0} remove labels`,
            dryRun: isDryRun,
          });
        } catch (error) {
          results.errors.push({
            filterId: filter.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return results;
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply filters: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

function buildSearchQuery(criteria: any): string {
  const queryParts: string[] = [];

  if (criteria.from) {
    queryParts.push(`from:${escapeSearchQuery(criteria.from)}`);
  }
  if (criteria.to) {
    queryParts.push(`to:${escapeSearchQuery(criteria.to)}`);
  }
  if (criteria.subject) {
    queryParts.push(`subject:${escapeSearchQuery(criteria.subject)}`);
  }
  if (criteria.query) {
    queryParts.push(`(${criteria.query})`);
  }
  if (criteria.hasAttachment) {
    queryParts.push("has:attachment");
  }

  return queryParts.join(" ");
}

function escapeSearchQuery(text: string): string {
  // Gmail search query escaping
  return `"${text.replace(/"/g, '\\"')}"`;
}

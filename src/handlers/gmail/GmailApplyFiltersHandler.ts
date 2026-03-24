import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { buildSearchQuery, buildGmailModifyRequest } from "./gmailUtils.js";
import { formatErrorMessage } from "../core/errorFormatting.js";

export interface GmailApplyFiltersInput {
  dryRun?: boolean;
}

export class GmailApplyFiltersHandler extends BaseToolHandler {
  async runTool(args: GmailApplyFiltersInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return this.toResult(result);
  }

  async execute(input: GmailApplyFiltersInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = this.getGmail(oauth2Client);
    const isDryRun = input.dryRun ?? false;

    try {
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
          await this.applyFilter(gmail, filter, isDryRun, results);
        } catch (error) {
          results.errors.push({
            filterId: filter.id,
            error: formatErrorMessage(error),
          });
        }
      }

      return results;
    } catch (error) {
      return {
        success: false,
        error: `Failed to apply filters: ${formatErrorMessage(error)}`,
      };
    }
  }

  private async applyFilter(
    gmail: any,
    filter: any,
    isDryRun: boolean,
    results: any
  ): Promise<void> {
    const criteria = filter.criteria || {};
    const action = filter.action || {};
    const searchQuery = buildSearchQuery(criteria);

    if (!searchQuery) {
      results.errors.push({
        filterId: filter.id,
        error: "Could not build search query from filter criteria",
      });
      return;
    }

    const messagesResponse = await gmail.users.messages.list({
      userId: "me",
      q: searchQuery,
      maxResults: 500,
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
      return;
    }

    let processed = 0;
    let failed = 0;

    for (const message of messages) {
      try {
        if (isDryRun) {
          processed++;
          continue;
        }

        const modifyRequest = buildGmailModifyRequest(action);

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
  }
}

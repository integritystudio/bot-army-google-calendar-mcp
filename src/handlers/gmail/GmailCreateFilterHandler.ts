import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { buildSearchQuery, validateInput } from "./gmailUtils.js";
import { formatErrorMessage } from "../core/errorFormatting.js";

export interface GmailCreateFilterInput {
  criteria: {
    from?: string;
    to?: string;
    subject?: string;
    query?: string;
    hasAttachment?: boolean;
    excludeChats?: boolean;
  };
  action: {
    addLabelIds?: string[];
    removeLabelIds?: string[];
    archive?: boolean;
    markAsRead?: boolean;
    markAsSpam?: boolean;
    markAsTrash?: boolean;
    forward?: string;
    neverMarkAsSpam?: boolean;
  };
}

export class GmailCreateFilterHandler extends BaseToolHandler {
  async runTool(args: GmailCreateFilterInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return this.toResult(result);
  }

  async execute(input: GmailCreateFilterInput, oauth2Client: OAuth2Client): Promise<any> {
    try {
      validateInput(input.criteria, "filter criteria");
      validateInput(input.action, "filter action");

      const gmail = this.getGmail(oauth2Client);
      const criteria = this.buildCriteria(input.criteria);
      const action = this.buildAction(input.action);

      const response = await gmail.users.settings.filters.create({
        userId: "me",
        requestBody: { criteria, action },
      });

      return {
        success: true,
        filter: {
          id: response.data.id,
          criteria: response.data.criteria,
          action: response.data.action,
        },
        message: "Filter created successfully",
        summary: this.buildFilterSummary(input),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create filter: ${formatErrorMessage(error)}`,
      };
    }
  }

  private buildCriteria(input: any): any {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined && value !== false)
    );
  }

  private buildAction(input: any): any {
    const action: any = {};

    if (input.addLabelIds?.length) {
      action.addLabelIds = input.addLabelIds;
    }
    if (input.removeLabelIds?.length) {
      action.removeLabelIds = input.removeLabelIds;
    }
    if (input.archive) {
      action.skip = true;
    }
    if (input.markAsRead) {
      action.archive = true;
    }
    if (input.markAsSpam !== undefined) {
      action.markAsSpam = input.markAsSpam;
    }
    if (input.markAsTrash !== undefined) {
      action.markAsTrash = input.markAsTrash;
    }
    if (input.forward) {
      action.forward = input.forward;
    }
    if (input.neverMarkAsSpam !== undefined) {
      action.neverMarkAsSpam = input.neverMarkAsSpam;
    }

    return action;
  }

  private buildFilterSummary(input: GmailCreateFilterInput): string {
    const criteria: string[] = [];

    if (input.criteria.from) criteria.push(`from: ${input.criteria.from}`);
    if (input.criteria.to) criteria.push(`to: ${input.criteria.to}`);
    if (input.criteria.subject) criteria.push(`subject: ${input.criteria.subject}`);
    if (input.criteria.query) criteria.push(`query: ${input.criteria.query}`);
    if (input.criteria.hasAttachment) criteria.push("has attachment");
    if (input.criteria.excludeChats) criteria.push("exclude chats");

    const actions: string[] = [];

    if (input.action.addLabelIds?.length) {
      actions.push(`add ${input.action.addLabelIds.length} label(s)`);
    }
    if (input.action.removeLabelIds?.length) {
      actions.push(`remove ${input.action.removeLabelIds.length} label(s)`);
    }
    if (input.action.archive) actions.push("archive");
    if (input.action.markAsRead) actions.push("mark as read");
    if (input.action.markAsSpam) actions.push("mark as spam");
    if (input.action.markAsTrash) actions.push("mark as trash");
    if (input.action.forward) actions.push(`forward to ${input.action.forward}`);
    if (input.action.neverMarkAsSpam) actions.push("never mark as spam");

    return `Filter: IF (${criteria.join(", ")}) THEN ${actions.join(", ")}`;
  }
}

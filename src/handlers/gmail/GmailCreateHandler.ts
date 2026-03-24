import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ============================================================================
// Label Handler
// ============================================================================

export interface GmailCreateLabelInput {
  name: string;
  labelListVisibility?: "labelShow" | "labelHide";
  messageListVisibility?: "show" | "hide";
}

export class GmailCreateLabelHandler extends BaseToolHandler {
  async runTool(args: GmailCreateLabelInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  async execute(input: GmailCreateLabelInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    try {
      const response = await gmail.users.labels.create({
        userId: "me",
        requestBody: {
          name: input.name,
          labelListVisibility: input.labelListVisibility || "labelShow",
          messageListVisibility: input.messageListVisibility || "show",
        },
      });

      return {
        success: true,
        label: {
          id: response.data.id,
          name: response.data.name,
          messageCount: response.data.messagesTotal || 0,
          threadCount: response.data.threadsTotal || 0,
          labelListVisibility: response.data.labelListVisibility,
          messageListVisibility: response.data.messageListVisibility,
        },
        message: `Label "${input.name}" created successfully`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("already exists")) {
        return {
          success: false,
          error: `Label "${input.name}" already exists`,
          suggestion: "Use a different name or try to find the existing label",
        };
      }

      return {
        success: false,
        error: `Failed to create label: ${errorMessage}`,
      };
    }
  }
}

// ============================================================================
// Filter Handler
// ============================================================================

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
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  async execute(input: GmailCreateFilterInput, oauth2Client: OAuth2Client): Promise<any> {
    // Validate input
    if (!input.criteria || Object.keys(input.criteria).length === 0) {
      return {
        success: false,
        error: "At least one filter criteria is required",
      };
    }

    if (!input.action || Object.keys(input.action).length === 0) {
      return {
        success: false,
        error: "At least one filter action is required",
      };
    }

    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    try {
      // Build criteria object
      const criteria: any = {};

      if (input.criteria.from) {
        criteria.from = input.criteria.from;
      }
      if (input.criteria.to) {
        criteria.to = input.criteria.to;
      }
      if (input.criteria.subject) {
        criteria.subject = input.criteria.subject;
      }
      if (input.criteria.query) {
        criteria.query = input.criteria.query;
      }
      if (input.criteria.hasAttachment !== undefined) {
        criteria.hasAttachment = input.criteria.hasAttachment;
      }
      if (input.criteria.excludeChats !== undefined) {
        criteria.excludeChats = input.criteria.excludeChats;
      }

      // Build action object
      const action: any = {};

      if (input.action.addLabelIds && input.action.addLabelIds.length > 0) {
        action.addLabelIds = input.action.addLabelIds;
      }
      if (input.action.removeLabelIds && input.action.removeLabelIds.length > 0) {
        action.removeLabelIds = input.action.removeLabelIds;
      }
      if (input.action.archive) {
        action.skip = true; // Archive means skip inbox
      }
      if (input.action.markAsRead) {
        action.archive = true; // Mark as read by archiving
      }
      if (input.action.markAsSpam !== undefined) {
        action.markAsSpam = input.action.markAsSpam;
      }
      if (input.action.markAsTrash !== undefined) {
        action.markAsTrash = input.action.markAsTrash;
      }
      if (input.action.forward) {
        action.forward = input.action.forward;
      }
      if (input.action.neverMarkAsSpam !== undefined) {
        action.neverMarkAsSpam = input.action.neverMarkAsSpam;
      }

      // Create filter
      const response = await gmail.users.settings.filters.create({
        userId: "me",
        requestBody: {
          criteria,
          action,
        },
      });

      return {
        success: true,
        filter: {
          id: response.data.id,
          criteria: response.data.criteria,
          action: response.data.action,
        },
        message: "Filter created successfully",
        summary: buildFilterSummary(input),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        error: `Failed to create filter: ${errorMessage}`,
      };
    }
  }
}

// ============================================================================
// Shared Utilities
// ============================================================================

function buildFilterSummary(input: GmailCreateFilterInput): string {
  const criteriaList = [];

  if (input.criteria.from) criteriaList.push(`from: ${input.criteria.from}`);
  if (input.criteria.to) criteriaList.push(`to: ${input.criteria.to}`);
  if (input.criteria.subject) criteriaList.push(`subject: ${input.criteria.subject}`);
  if (input.criteria.query) criteriaList.push(`query: ${input.criteria.query}`);
  if (input.criteria.hasAttachment) criteriaList.push("has attachment");
  if (input.criteria.excludeChats) criteriaList.push("exclude chats");

  const actionList = [];

  if (input.action.addLabelIds?.length) {
    actionList.push(`add ${input.action.addLabelIds.length} label(s)`);
  }
  if (input.action.removeLabelIds?.length) {
    actionList.push(`remove ${input.action.removeLabelIds.length} label(s)`);
  }
  if (input.action.archive) actionList.push("archive");
  if (input.action.markAsRead) actionList.push("mark as read");
  if (input.action.markAsSpam) actionList.push("mark as spam");
  if (input.action.markAsTrash) actionList.push("mark as trash");
  if (input.action.forward) actionList.push(`forward to ${input.action.forward}`);
  if (input.action.neverMarkAsSpam) actionList.push("never mark as spam");

  return `Filter: IF (${criteriaList.join(", ")}) THEN ${actionList.join(", ")}`;
}

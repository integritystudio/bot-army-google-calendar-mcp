import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatErrorMessage } from "../core/errorFormatting.js";

export interface GmailModifyInput {
  messageIds: string[];
  action: "markRead" | "markUnread" | "archive" | "delete" | "addLabel" | "removeLabel";
  labelId?: string;
}

const ACTION_LABELS: Record<string, { addLabelIds?: string[]; removeLabelIds?: string[] }> = {
  markRead: { removeLabelIds: ["UNREAD"] },
  markUnread: { addLabelIds: ["UNREAD"] },
  archive: { removeLabelIds: ["INBOX"] },
};

const ACTION_DESCRIPTIONS: Record<string, string> = {
  markRead: "marked as read",
  markUnread: "marked as unread",
  archive: "archived",
  delete: "permanently deleted",
};

export class GmailModifyHandler extends BaseToolHandler {
  async runTool(args: GmailModifyInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return this.toResult(result);
  }

  async execute(input: GmailModifyInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = this.getGmail(oauth2Client);

    const results = {
      action: input.action,
      processed: 0,
      failed: 0,
      messages: [] as any[],
    };

    for (const messageId of input.messageIds) {
      try {
        const result = await this.applyAction(gmail, messageId, input);
        results.messages.push(result);
        results.processed++;
      } catch (error) {
        results.messages.push({
          id: messageId,
          action: input.action,
          success: false,
          error: formatErrorMessage(error),
        });
        results.failed++;
      }
    }

    return results;
  }

  private async applyAction(
    gmail: any,
    messageId: string,
    input: GmailModifyInput
  ): Promise<any> {
    if (input.action === "delete") {
      await gmail.users.messages.delete({ userId: "me", id: messageId });
      return {
        id: messageId,
        action: ACTION_DESCRIPTIONS.delete,
        success: true,
      };
    }

    if (input.action === "addLabel" || input.action === "removeLabel") {
      if (!input.labelId) {
        throw new Error(`labelId required for ${input.action} action`);
      }

      const requestBody =
        input.action === "addLabel"
          ? { addLabelIds: [input.labelId] }
          : { removeLabelIds: [input.labelId] };

      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody,
      });

      const verb = input.action === "addLabel" ? "added" : "removed";
      return {
        id: messageId,
        action: `${verb} label ${input.labelId}`,
        success: true,
      };
    }

    const labels = ACTION_LABELS[input.action];
    if (!labels) {
      throw new Error(`Unknown action: ${input.action}`);
    }

    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: labels,
    });

    return {
      id: messageId,
      action: ACTION_DESCRIPTIONS[input.action],
      success: true,
    };
  }
}

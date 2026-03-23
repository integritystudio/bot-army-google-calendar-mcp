import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface GmailModifyInput {
  messageIds: string[];
  action: "markRead" | "markUnread" | "archive" | "delete" | "addLabel" | "removeLabel";
  labelId?: string;
}

export class GmailModifyHandler extends BaseToolHandler {
  async runTool(args: GmailModifyInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  async execute(input: GmailModifyInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const results = {
      action: input.action,
      processed: 0,
      failed: 0,
      messages: [] as any[],
    };

    for (const messageId of input.messageIds) {
      try {
        let response;

        switch (input.action) {
          case "markRead":
            response = await gmail.users.messages.modify({
              userId: "me",
              id: messageId,
              requestBody: {
                removeLabelIds: ["UNREAD"],
              },
            });
            results.messages.push({
              id: messageId,
              action: "marked as read",
              success: true,
            });
            results.processed++;
            break;

          case "markUnread":
            response = await gmail.users.messages.modify({
              userId: "me",
              id: messageId,
              requestBody: {
                addLabelIds: ["UNREAD"],
              },
            });
            results.messages.push({
              id: messageId,
              action: "marked as unread",
              success: true,
            });
            results.processed++;
            break;

          case "archive":
            response = await gmail.users.messages.modify({
              userId: "me",
              id: messageId,
              requestBody: {
                removeLabelIds: ["INBOX"],
              },
            });
            results.messages.push({
              id: messageId,
              action: "archived",
              success: true,
            });
            results.processed++;
            break;

          case "delete":
            await gmail.users.messages.delete({
              userId: "me",
              id: messageId,
            });
            results.messages.push({
              id: messageId,
              action: "permanently deleted",
              success: true,
            });
            results.processed++;
            break;

          case "addLabel":
            if (!input.labelId) {
              throw new Error("labelId required for addLabel action");
            }
            response = await gmail.users.messages.modify({
              userId: "me",
              id: messageId,
              requestBody: {
                addLabelIds: [input.labelId],
              },
            });
            results.messages.push({
              id: messageId,
              action: `added label ${input.labelId}`,
              success: true,
            });
            results.processed++;
            break;

          case "removeLabel":
            if (!input.labelId) {
              throw new Error("labelId required for removeLabel action");
            }
            response = await gmail.users.messages.modify({
              userId: "me",
              id: messageId,
              requestBody: {
                removeLabelIds: [input.labelId],
              },
            });
            results.messages.push({
              id: messageId,
              action: `removed label ${input.labelId}`,
              success: true,
            });
            results.processed++;
            break;

          default:
            throw new Error(`Unknown action: ${input.action}`);
        }
      } catch (error) {
        results.messages.push({
          id: messageId,
          action: input.action,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
        results.failed++;
      }
    }

    return results;
  }
}

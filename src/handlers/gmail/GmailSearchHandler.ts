import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export interface GmailSearchInput {
  query: string;
  maxResults?: number;
  pageToken?: string;
}

export class GmailSearchHandler extends BaseToolHandler {
  async runTool(args: GmailSearchInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  async execute(input: GmailSearchInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = google.gmail({
      version: "v1",
      auth: oauth2Client,
    });

    const response = await gmail.users.messages.list({
      userId: "me",
      q: input.query,
      maxResults: input.maxResults || 10,
      pageToken: input.pageToken,
    });

    const messageCount = response.data.resultSizeEstimate || 0;
    const messages = response.data.messages || [];

    // Fetch full message details if requested
    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const fullMsg = await gmail.users.messages.get({
            userId: "me",
            id: msg.id!,
            format: "metadata",
            metadataHeaders: ["Subject", "From", "Date"],
          });

          const headers = fullMsg.data.payload?.headers || [];
          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: fullMsg.data.snippet,
            subject: headers.find((h) => h.name === "Subject")?.value,
            from: headers.find((h) => h.name === "From")?.value,
            date: headers.find((h) => h.name === "Date")?.value,
          };
        } catch (error) {
          return {
            id: msg.id,
            error: `Failed to fetch message details: ${error}`,
          };
        }
      })
    );

    return {
      total: messageCount,
      returned: messages.length,
      messages: detailedMessages,
      nextPageToken: response.data.nextPageToken,
    };
  }
}

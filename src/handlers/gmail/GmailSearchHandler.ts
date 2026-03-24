import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fetchMessageDetails } from "./gmailUtils.js";
import { formatErrorMessage } from "../core/errorFormatting.js";

export interface GmailSearchInput {
  query: string;
  maxResults?: number;
  pageToken?: string;
}

export class GmailSearchHandler extends BaseToolHandler {
  async runTool(args: GmailSearchInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return this.toResult(result);
  }

  async execute(input: GmailSearchInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = this.getGmail(oauth2Client);

    const response = await gmail.users.messages.list({
      userId: "me",
      q: input.query,
      maxResults: input.maxResults || 10,
      pageToken: input.pageToken,
    });

    const messageCount = response.data.resultSizeEstimate || 0;
    const messages = response.data.messages || [];

    const detailedMessages = await Promise.all(
      messages.map(async (msg) => {
        try {
          const details = await fetchMessageDetails(gmail, msg.id!);
          return {
            id: msg.id,
            threadId: msg.threadId,
            snippet: details.snippet,
            subject: details.headers.Subject,
            from: details.headers.From,
            date: details.headers.Date,
          };
        } catch (error) {
          return {
            id: msg.id,
            error: formatErrorMessage(error),
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

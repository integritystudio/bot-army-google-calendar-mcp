import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class GmailGetProfileHandler extends BaseToolHandler {
  async runTool(_args: any, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(oauth2Client);
    return this.toResult(result);
  }

  async execute(oauth2Client: OAuth2Client): Promise<any> {
    const gmail = this.getGmail(oauth2Client);

    const profile = await gmail.users.getProfile({
      userId: "me",
    });

    return {
      emailAddress: profile.data.emailAddress,
      messagesTotal: profile.data.messagesTotal,
      threadsTotal: profile.data.threadsTotal,
      historyId: profile.data.historyId,
    };
  }
}

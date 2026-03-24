import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatErrorMessage } from "../core/errorFormatting.js";

export interface GmailCreateLabelInput {
  name: string;
  labelListVisibility?: "labelShow" | "labelHide";
  messageListVisibility?: "show" | "hide";
}

export class GmailCreateLabelHandler extends BaseToolHandler {
  async runTool(args: GmailCreateLabelInput, oauth2Client: OAuth2Client): Promise<CallToolResult> {
    const result = await this.execute(args, oauth2Client);
    return this.toResult(result);
  }

  async execute(input: GmailCreateLabelInput, oauth2Client: OAuth2Client): Promise<any> {
    const gmail = this.getGmail(oauth2Client);

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
      const errorMessage = getErrorMessage(error);

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

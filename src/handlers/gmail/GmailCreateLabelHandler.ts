import { BaseToolHandler } from "../core/BaseToolHandler.js";
import { OAuth2Client } from "google-auth-library";
import { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatErrorMessage } from "../core/errorFormatting.js";
import { gmail_v1 } from "googleapis";
import { getLabelByName, isAlreadyExistsError } from "../../shared/gmail-core.js";
import { GmailCreateLabelInput } from "../../tools/registry.js";

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
        created: true,
        label: this.formatLabel(response.data),
        message: `Label "${input.name}" created successfully`,
      };
    } catch (error) {
      // A label that already exists satisfies the caller's intent, so resolve it
      // rather than failing: every caller of a failed create wants the existing id
      // next, and returning an error makes each one re-implement the lookup.
      if (isAlreadyExistsError(error)) {
        const existing = await getLabelByName(gmail, input.name);

        if (existing) {
          return {
            success: true,
            created: false,
            label: this.formatLabel(existing),
            message: `Label "${input.name}" already exists`,
          };
        }
      }

      return {
        success: false,
        error: `Failed to create label: ${formatErrorMessage(error)}`,
      };
    }
  }

  private formatLabel(label: gmail_v1.Schema$Label) {
    return {
      id: label.id,
      name: label.name,
      messageCount: label.messagesTotal || 0,
      threadCount: label.threadsTotal || 0,
      labelListVisibility: label.labelListVisibility,
      messageListVisibility: label.messageListVisibility,
    };
  }
}

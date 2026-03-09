import { UmbPropertyActionBase } from "@umbraco-cms/backoffice/property-action";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT } from "@umbraco-cms/backoffice/document";

const API_BASE = "/umbraco/api/image-generator";

export class GenerateImagePropertyAction extends UmbPropertyActionBase {
  async execute() {
    const workspaceContext = await this.getContext(
      UMB_DOCUMENT_WORKSPACE_CONTEXT
    );
    const notificationContext = await this.getContext(
      UMB_NOTIFICATION_CONTEXT
    );

    const documentId = workspaceContext?.getUnique();
    if (!documentId) {
      notificationContext?.peek("danger", {
        data: {
          headline: "Generation failed",
          message: "Could not determine the current document ID.",
        },
      });
      return;
    }

    const authContext = await this.getContext(UMB_AUTH_CONTEXT);
    const token = await authContext?.getLatestToken();

    notificationContext?.peek("positive", {
      data: { headline: "Generating image…", message: "Please wait…" },
    });

    try {
      const response = await fetch(
        `${API_BASE}/generate/${documentId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        notificationContext?.peek("positive", {
          data: {
            headline: "Image generated",
            message:
              "Reload the page to see the new image in the media picker.",
          },
        });
      } else {
        const errorText = await response.text();
        notificationContext?.peek("danger", {
          data: {
            headline: "Generation failed",
            message: errorText || `Server returned ${response.status}`,
          },
        });
      }
    } catch (err) {
      notificationContext?.peek("danger", {
        data: {
          headline: "Generation failed",
          message: err instanceof Error ? err.message : "Network error",
        },
      });
    }
  }
}

export default GenerateImagePropertyAction;

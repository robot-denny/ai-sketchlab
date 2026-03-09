import { UmbPropertyActionBase as i } from "@umbraco-cms/backoffice/property-action";
import { UMB_AUTH_CONTEXT as s } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as d } from "@umbraco-cms/backoffice/notification";
import { UMB_DOCUMENT_WORKSPACE_CONTEXT as m } from "@umbraco-cms/backoffice/document";
const c = "/umbraco/api/image-generator";
class f extends i {
  async execute() {
    const n = await this.getContext(
      m
    ), t = await this.getContext(
      d
    ), a = n?.getUnique();
    if (!a) {
      t?.peek("danger", {
        data: {
          headline: "Generation failed",
          message: "Could not determine the current document ID."
        }
      });
      return;
    }
    const o = await (await this.getContext(s))?.getLatestToken();
    t?.peek("positive", {
      data: { headline: "Generating image…", message: "Please wait…" }
    });
    try {
      const e = await fetch(
        `${c}/generate/${a}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${o}` }
        }
      );
      if (e.ok)
        t?.peek("positive", {
          data: {
            headline: "Image generated",
            message: "Reload the page to see the new image in the media picker."
          }
        });
      else {
        const r = await e.text();
        t?.peek("danger", {
          data: {
            headline: "Generation failed",
            message: r || `Server returned ${e.status}`
          }
        });
      }
    } catch (e) {
      t?.peek("danger", {
        data: {
          headline: "Generation failed",
          message: e instanceof Error ? e.message : "Network error"
        }
      });
    }
  }
}
export {
  f as GenerateImagePropertyAction,
  f as default
};
//# sourceMappingURL=generateImage.action-DmjEez86.js.map

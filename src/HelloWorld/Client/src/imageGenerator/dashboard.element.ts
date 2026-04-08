import {
  css,
  html,
  customElement,
  state,
  nothing,
} from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement } from "@umbraco-cms/backoffice/lit-element";
import { UMB_AUTH_CONTEXT } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT } from "@umbraco-cms/backoffice/notification";

// -- Types --

interface Article {
  id: string;
  name: string;
}

const API_BASE = "/umbraco/api/image-generator";

// -- Element --

@customElement("image-generator-dashboard")
export default class ImageGeneratorDashboardElement extends UmbLitElement {
  @state() private _articles: Article[] = [];
  @state() private _selectedArticleId = "";
  @state() private _forceRegenerate = false;
  @state() private _generating = false;
  @state() private _batchRunning = false;
  @state() private _output = "";

  #authContext?: typeof UMB_AUTH_CONTEXT.TYPE;
  #notificationContext?: typeof UMB_NOTIFICATION_CONTEXT.TYPE;

  constructor() {
    super();

    this.consumeContext(UMB_AUTH_CONTEXT, (ctx) => {
      this.#authContext = ctx;
    });

    this.consumeContext(UMB_NOTIFICATION_CONTEXT, (ctx) => {
      this.#notificationContext = ctx;
    });
  }

  async connectedCallback() {
    super.connectedCallback();
    await this.#loadData();
  }

  // -- Data Loading --

  async #loadData() {
    const articles = await this.#apiFetch<Article[]>("GET", "/articles");
    if (articles) this._articles = articles;
  }

  // -- API Helpers --

  async #getToken(): Promise<string | undefined> {
    return await this.#authContext?.getLatestToken();
  }

  async #apiFetch<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T | null> {
    const token = await this.#getToken();
    const opts: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    try {
      const res = await fetch(`${API_BASE}${path}`, opts);
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }

  // -- Generate Actions --

  #onGenerate = async () => {
    if (!this._selectedArticleId) return;
    this._generating = true;
    this._output = "";

    const qs = this._forceRegenerate ? "?force=true" : "";
    const result = await this.#apiFetch<{ success: boolean; output: string }>(
      "POST",
      `/generate/${this._selectedArticleId}${qs}`
    );
    this._generating = false;

    if (result?.success) {
      this._output = result.output;
      this.#notificationContext?.peek("positive", {
        data: {
          headline: "Image generated",
          message: "Reload the article to see the new image.",
        },
      });
    } else {
      this._output = result?.output ?? "Generation failed";
      this.#notificationContext?.peek("danger", {
        data: { headline: "Generation failed", message: "" },
      });
    }
  };

  #onBatch = async (force: boolean) => {
    this._batchRunning = true;
    this._output = "";

    const qs = force ? "?force=true" : "";
    const result = await this.#apiFetch<{ success: boolean; output: string }>(
      "POST",
      `/generate/batch${qs}`
    );
    this._batchRunning = false;

    if (result) {
      this._output = result.output;
      this.#notificationContext?.peek(result.success ? "positive" : "warning", {
        data: {
          headline: result.success
            ? "Batch complete"
            : "Batch completed with errors",
          message: "",
        },
      });
    } else {
      this.#notificationContext?.peek("danger", {
        data: { headline: "Batch generation failed", message: "" },
      });
    }
  };

  // -- Render --

  render() {
    return html`
      ${this.#renderPaletteInfo()} ${this.#renderSingleGenerator()}
      ${this.#renderBatchGenerator()}
      ${this._output ? this.#renderOutput() : nothing}
    `;
  }

  #renderPaletteInfo() {
    return html`
      <uui-box headline="Palette Settings">
        <p>
          Category color palettes are managed in the content tree:
          <strong>Home → Site Settings → Image Generator Settings</strong>.
          Open the settings document to add, edit, or remove category palette entries.
        </p>
      </uui-box>
    `;
  }

  #renderSingleGenerator() {
    return html`
      <uui-box headline="Generate for Article">
        <p>Generate a flow-field image for a single article.</p>

        <div class="form-row">
          <uui-select
            label="Select article"
            .options=${this._articles.map((a) => ({
              name: a.name,
              value: a.id,
              selected: a.id === this._selectedArticleId,
            }))}
            @change=${(e: Event) => {
              this._selectedArticleId = (e.target as HTMLSelectElement).value;
            }}
          ></uui-select>
        </div>

        <div class="form-row">
          <label>
            <uui-toggle
              .checked=${this._forceRegenerate}
              @change=${(e: Event) => {
                this._forceRegenerate = (e.target as HTMLInputElement).checked;
              }}
            ></uui-toggle>
            Force regenerate (overwrite existing image)
          </label>
        </div>

        <div class="actions">
          <uui-button
            color="positive"
            look="primary"
            label="Generate"
            .state=${this._generating ? "waiting" : undefined}
            ?disabled=${!this._selectedArticleId}
            @click=${this.#onGenerate}
          >
            Generate Image
          </uui-button>
        </div>
      </uui-box>
    `;
  }

  #renderBatchGenerator() {
    return html`
      <uui-box headline="Batch Generation">
        <p>Generate images for multiple articles at once.</p>

        <div class="actions">
          <uui-button
            look="primary"
            label="Generate missing"
            .state=${this._batchRunning ? "waiting" : undefined}
            @click=${() => this.#onBatch(false)}
          >
            Generate Missing
          </uui-button>
          <uui-button
            color="danger"
            look="secondary"
            label="Regenerate all"
            .state=${this._batchRunning ? "waiting" : undefined}
            @click=${() => this.#onBatch(true)}
          >
            Regenerate All
          </uui-button>
        </div>
      </uui-box>
    `;
  }

  #renderOutput() {
    return html`
      <uui-box headline="Output">
        <pre class="cli-output" role="region" aria-label="Command output" tabindex="0">${this._output}</pre>
      </uui-box>
    `;
  }

  // -- Styles --

  static styles = [
    css`
      :host {
        display: block;
        padding: var(--uui-size-layout-1);
      }

      uui-box {
        margin-bottom: var(--uui-size-layout-1);
      }

      .form-row {
        margin-bottom: var(--uui-size-space-4);
      }

      .form-row label {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-2);
      }

      .actions {
        display: flex;
        gap: var(--uui-size-space-2);
      }

      uui-select {
        width: 100%;
        max-width: 400px;
      }

      .cli-output {
        background: var(--uui-color-surface-alt);
        padding: var(--uui-size-space-4);
        border-radius: var(--uui-border-radius);
        font-family: monospace;
        font-size: 13px;
        white-space: pre-wrap;
        word-break: break-word;
        max-height: 400px;
        overflow-y: auto;
        margin: 0;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "image-generator-dashboard": ImageGeneratorDashboardElement;
  }
}

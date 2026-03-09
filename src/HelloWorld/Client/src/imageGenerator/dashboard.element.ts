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

type RgbColor = [number, number, number];

interface PaletteConfig {
  entries: Record<string, RgbColor[]>;
  default: RgbColor[];
}

interface Article {
  id: string;
  name: string;
}

// -- Helpers --

const hexToRgb = (hex: string): RgbColor => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]: RgbColor) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

const API_BASE = "/umbraco/api/image-generator";

// -- Element --

@customElement("image-generator-dashboard")
export default class ImageGeneratorDashboardElement extends UmbLitElement {
  @state() private _palettes: PaletteConfig = { entries: {}, default: [] };
  @state() private _articles: Article[] = [];
  @state() private _selectedArticleId = "";
  @state() private _forceRegenerate = false;
  @state() private _generating = false;
  @state() private _batchRunning = false;
  @state() private _output = "";
  @state() private _savingPalettes = false;
  @state() private _newCategoryName = "";

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
    const [palettes, articles] = await Promise.all([
      this.#apiFetch<PaletteConfig>("GET", "/palettes"),
      this.#apiFetch<Article[]>("GET", "/articles"),
    ]);
    if (palettes) this._palettes = palettes;
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

  // -- Palette Actions --

  #onColorChange(category: string, index: number, hex: string) {
    const entries = { ...this._palettes.entries };
    entries[category] = [...entries[category]];
    entries[category][index] = hexToRgb(hex);
    this._palettes = { ...this._palettes, entries };
  }

  #onDefaultColorChange(index: number, hex: string) {
    const def = [...this._palettes.default] as RgbColor[];
    def[index] = hexToRgb(hex);
    this._palettes = { ...this._palettes, default: def };
  }

  #addColorToCategory(category: string) {
    const entries = { ...this._palettes.entries };
    entries[category] = [...entries[category], [0, 140, 200] as RgbColor];
    this._palettes = { ...this._palettes, entries };
  }

  #removeColorFromCategory(category: string, index: number) {
    const entries = { ...this._palettes.entries };
    entries[category] = entries[category].filter((_, i) => i !== index);
    this._palettes = { ...this._palettes, entries };
  }

  #removeCategory(category: string) {
    const entries = { ...this._palettes.entries };
    delete entries[category];
    this._palettes = { ...this._palettes, entries };
  }

  #addCategory() {
    const name = this._newCategoryName.trim();
    if (!name || this._palettes.entries[name]) return;
    const entries = { ...this._palettes.entries };
    entries[name] = [[0, 140, 200] as RgbColor];
    this._palettes = { ...this._palettes, entries };
    this._newCategoryName = "";
  }

  #onSavePalettes = async () => {
    this._savingPalettes = true;
    const result = await this.#apiFetch<{ success: boolean }>(
      "PUT",
      "/palettes",
      this._palettes
    );
    this._savingPalettes = false;

    if (result?.success) {
      this.#notificationContext?.peek("positive", {
        data: { headline: "Palettes saved", message: "" },
      });
    } else {
      this.#notificationContext?.peek("danger", {
        data: { headline: "Failed to save palettes", message: "" },
      });
    }
  };

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
      ${this.#renderPaletteEditor()} ${this.#renderSingleGenerator()}
      ${this.#renderBatchGenerator()}
      ${this._output ? this.#renderOutput() : nothing}
    `;
  }

  #renderPaletteEditor() {
    const categories = Object.entries(this._palettes.entries);

    return html`
      <uui-box headline="Category Colors">
        <p>
          Each category maps to a set of colors used in generated flow-field
          images. Articles with multiple categories merge all matching palettes.
        </p>

        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Colors</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${categories.map(
              ([cat, colors]) => html`
                <tr>
                  <td class="category-name">${cat}</td>
                  <td class="color-cells">
                    ${colors.map(
                      (c, i) => html`
                        <span class="color-slot">
                          <input
                            type="color"
                            .value=${rgbToHex(c)}
                            @input=${(e: Event) =>
                              this.#onColorChange(
                                cat,
                                i,
                                (e.target as HTMLInputElement).value
                              )}
                          />
                          <uui-button
                            compact
                            look="secondary"
                            label="Remove color"
                            @click=${() =>
                              this.#removeColorFromCategory(cat, i)}
                            >x</uui-button
                          >
                        </span>
                      `
                    )}
                    <uui-button
                      compact
                      look="outline"
                      label="Add color"
                      @click=${() => this.#addColorToCategory(cat)}
                      >+</uui-button
                    >
                  </td>
                  <td>
                    <uui-button
                      compact
                      color="danger"
                      look="secondary"
                      label="Remove category"
                      @click=${() => this.#removeCategory(cat)}
                    >
                      Remove
                    </uui-button>
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>

        <div class="default-palette">
          <strong>Default palette:</strong>
          ${this._palettes.default.map(
            (c, i) => html`
              <input
                type="color"
                .value=${rgbToHex(c)}
                @input=${(e: Event) =>
                  this.#onDefaultColorChange(
                    i,
                    (e.target as HTMLInputElement).value
                  )}
              />
            `
          )}
        </div>

        <div class="add-category">
          <uui-input
            label="New category name"
            placeholder="Category name"
            .value=${this._newCategoryName}
            @input=${(e: Event) => {
              this._newCategoryName = (e.target as HTMLInputElement).value;
            }}
          ></uui-input>
          <uui-button look="outline" label="Add category" @click=${this.#addCategory}>
            Add Category
          </uui-button>
        </div>

        <div class="actions">
          <uui-button
            color="positive"
            look="primary"
            label="Save palettes"
            .state=${this._savingPalettes ? "waiting" : undefined}
            @click=${this.#onSavePalettes}
          >
            Save Palettes
          </uui-button>
        </div>
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
              label="Force regenerate"
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
        <pre class="cli-output">${this._output}</pre>
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

      table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: var(--uui-size-space-4);
      }

      th {
        text-align: left;
        padding: var(--uui-size-space-2);
        border-bottom: 1px solid var(--uui-color-border);
      }

      td {
        padding: var(--uui-size-space-2);
        vertical-align: middle;
      }

      .category-name {
        font-weight: 600;
        white-space: nowrap;
      }

      .color-cells {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-2);
        flex-wrap: wrap;
      }

      .color-slot {
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      input[type="color"] {
        width: 36px;
        height: 28px;
        border: 1px solid var(--uui-color-border);
        border-radius: 4px;
        padding: 0;
        cursor: pointer;
      }

      .default-palette {
        display: flex;
        align-items: center;
        gap: var(--uui-size-space-2);
        margin-bottom: var(--uui-size-space-4);
      }

      .add-category {
        display: flex;
        gap: var(--uui-size-space-2);
        align-items: end;
        margin-bottom: var(--uui-size-space-4);
      }

      .add-category uui-input {
        flex: 1;
        max-width: 300px;
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

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

interface PaletteEntry {
  name: string;
  colors: RgbColor[];
}

interface PaletteConfig {
  entries: Record<string, PaletteEntry>; // UUID → {name, colors}
  default: RgbColor[];
}

interface Article {
  id: string;
  name: string;
}

interface Category {
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
  @state() private _categories: Category[] = [];
  @state() private _selectedArticleId = "";
  @state() private _selectedNewCategoryId = "";
  @state() private _forceRegenerate = false;
  @state() private _generating = false;
  @state() private _batchRunning = false;
  @state() private _output = "";
  @state() private _savingPalettes = false;

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
    const [palettes, articles, categories] = await Promise.all([
      this.#apiFetch<PaletteConfig>("GET", "/palettes"),
      this.#apiFetch<Article[]>("GET", "/articles"),
      this.#apiFetch<Category[]>("GET", "/categories"),
    ]);
    if (palettes) this._palettes = palettes;
    if (articles) this._articles = articles;
    if (categories) this._categories = categories;

    this.#syncCategoryNames();
  }

  /**
   * Auto-sync display names: if a category was renamed in Umbraco,
   * update the name field in the palette entry and notify the user.
   */
  #syncCategoryNames() {
    const catMap = new Map(this._categories.map((c) => [c.id, c.name]));
    let changed = false;
    const entries = { ...this._palettes.entries };

    for (const [uuid, entry] of Object.entries(entries)) {
      const liveName = catMap.get(uuid);
      if (liveName && liveName !== entry.name) {
        entries[uuid] = { ...entry, name: liveName };
        changed = true;
      }
    }

    if (changed) {
      this._palettes = { ...this._palettes, entries };
      this.#notificationContext?.peek("warning", {
        data: {
          headline: "Category names updated",
          message:
            "Some categories were renamed in the CMS. Save palettes to persist the updated names.",
        },
      });
    }
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

  // -- Computed --

  get #unassignedCategories(): Category[] {
    return this._categories.filter((c) => !this._palettes.entries[c.id]);
  }

  #isCategoryOrphaned(uuid: string): boolean {
    return !this._categories.some((c) => c.id === uuid);
  }

  // -- Palette Actions --

  #onColorChange(uuid: string, index: number, hex: string) {
    const entries = { ...this._palettes.entries };
    const entry = entries[uuid];
    const colors = [...entry.colors];
    colors[index] = hexToRgb(hex);
    entries[uuid] = { ...entry, colors };
    this._palettes = { ...this._palettes, entries };
  }

  #onDefaultColorChange(index: number, hex: string) {
    const def = [...this._palettes.default] as RgbColor[];
    def[index] = hexToRgb(hex);
    this._palettes = { ...this._palettes, default: def };
  }

  #addColorToCategory(uuid: string) {
    const entries = { ...this._palettes.entries };
    const entry = entries[uuid];
    entries[uuid] = { ...entry, colors: [...entry.colors, [0, 140, 200] as RgbColor] };
    this._palettes = { ...this._palettes, entries };
  }

  #removeColorFromCategory(uuid: string, index: number) {
    const entries = { ...this._palettes.entries };
    const entry = entries[uuid];
    entries[uuid] = { ...entry, colors: entry.colors.filter((_, i) => i !== index) };
    this._palettes = { ...this._palettes, entries };
  }

  #removeCategory(uuid: string) {
    const entries = { ...this._palettes.entries };
    delete entries[uuid];
    this._palettes = { ...this._palettes, entries };
  }

  #addCategory() {
    const id = this._selectedNewCategoryId;
    if (!id || this._palettes.entries[id]) return;
    const cat = this._categories.find((c) => c.id === id);
    if (!cat) return;
    const entries = { ...this._palettes.entries };
    entries[id] = { name: cat.name, colors: [[0, 140, 200] as RgbColor] };
    this._palettes = { ...this._palettes, entries };
    this._selectedNewCategoryId = "";
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
    const unassigned = this.#unassignedCategories;

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
              ([uuid, entry]) => html`
                <tr>
                  <td class="category-name">
                    ${entry.name}
                    ${this.#isCategoryOrphaned(uuid)
                      ? html`<span class="orphan-badge" title="This category no longer exists in the CMS">Deleted</span>`
                      : nothing}
                  </td>
                  <td class="color-cells">
                    ${entry.colors.map(
                      (c, i) => html`
                        <span class="color-slot">
                          <input
                            type="color"
                            .value=${rgbToHex(c)}
                            @input=${(e: Event) =>
                              this.#onColorChange(
                                uuid,
                                i,
                                (e.target as HTMLInputElement).value
                              )}
                          />
                          <uui-button
                            compact
                            look="secondary"
                            label="Remove color"
                            @click=${() =>
                              this.#removeColorFromCategory(uuid, i)}
                            >x</uui-button
                          >
                        </span>
                      `
                    )}
                    <uui-button
                      compact
                      look="outline"
                      label="Add color"
                      @click=${() => this.#addColorToCategory(uuid)}
                      >+</uui-button
                    >
                  </td>
                  <td>
                    <uui-button
                      compact
                      color="danger"
                      look="secondary"
                      label="Remove category"
                      @click=${() => this.#removeCategory(uuid)}
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
          ${unassigned.length > 0
            ? html`
                <uui-select
                  label="Select category"
                  placeholder="Select a category..."
                  .options=${[
                    { name: "Select a category...", value: "", selected: !this._selectedNewCategoryId },
                    ...unassigned.map((c) => ({
                      name: c.name,
                      value: c.id,
                      selected: c.id === this._selectedNewCategoryId,
                    })),
                  ]}
                  @change=${(e: Event) => {
                    this._selectedNewCategoryId = (e.target as HTMLSelectElement).value;
                  }}
                ></uui-select>
                <uui-button
                  look="outline"
                  label="Add category"
                  ?disabled=${!this._selectedNewCategoryId}
                  @click=${this.#addCategory}
                >
                  Add Category
                </uui-button>
              `
            : html`<em>All categories have palette entries assigned.</em>`}
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

      .orphan-badge {
        display: inline-block;
        background: var(--uui-color-danger);
        color: var(--uui-color-danger-contrast);
        font-size: 11px;
        font-weight: 600;
        padding: 1px 6px;
        border-radius: 3px;
        margin-left: 8px;
        vertical-align: middle;
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

      .add-category uui-select {
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

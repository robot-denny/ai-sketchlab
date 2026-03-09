import { nothing as M, html as d, css as D, state as p, customElement as W } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as F } from "@umbraco-cms/backoffice/lit-element";
import { UMB_AUTH_CONTEXT as U } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as j } from "@umbraco-cms/backoffice/notification";
var q = Object.defineProperty, H = Object.getOwnPropertyDescriptor, k = (e) => {
  throw TypeError(e);
}, c = (e, t, a, i) => {
  for (var o = i > 1 ? void 0 : i ? H(t, a) : t, h = e.length - 1, v; h >= 0; h--)
    (v = e[h]) && (o = (i ? v(t, a, o) : v(o)) || o);
  return i && o && q(t, a, o), o;
}, b = (e, t, a) => t.has(e) || k("Cannot " + a), l = (e, t, a) => (b(e, t, "read from private field"), t.get(e)), g = (e, t, a) => t.has(e) ? k("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, a), x = (e, t, a, i) => (b(e, t, "write to private field"), t.set(e, a), a), r = (e, t, a) => (b(e, t, "access private method"), a), f, u, s, C, A, _, T, G, P, R, z, I, y, w, m, O, S, E, N;
const B = (e) => {
  const t = parseInt(e.slice(1), 16);
  return [t >> 16 & 255, t >> 8 & 255, t & 255];
}, $ = ([e, t, a]) => "#" + [e, t, a].map((i) => i.toString(16).padStart(2, "0")).join(""), L = "/umbraco/api/image-generator";
let n = class extends F {
  constructor() {
    super(), g(this, s), this._palettes = { entries: {}, default: [] }, this._articles = [], this._selectedArticleId = "", this._forceRegenerate = !1, this._generating = !1, this._batchRunning = !1, this._output = "", this._savingPalettes = !1, this._newCategoryName = "", g(this, f), g(this, u), g(this, y, async () => {
      this._savingPalettes = !0;
      const e = await r(this, s, _).call(this, "PUT", "/palettes", this._palettes);
      this._savingPalettes = !1, e?.success ? l(this, u)?.peek("positive", {
        data: { headline: "Palettes saved", message: "" }
      }) : l(this, u)?.peek("danger", {
        data: { headline: "Failed to save palettes", message: "" }
      });
    }), g(this, w, async () => {
      if (!this._selectedArticleId) return;
      this._generating = !0, this._output = "";
      const e = this._forceRegenerate ? "?force=true" : "", t = await r(this, s, _).call(this, "POST", `/generate/${this._selectedArticleId}${e}`);
      this._generating = !1, t?.success ? (this._output = t.output, l(this, u)?.peek("positive", {
        data: {
          headline: "Image generated",
          message: "Reload the article to see the new image."
        }
      })) : (this._output = t?.output ?? "Generation failed", l(this, u)?.peek("danger", {
        data: { headline: "Generation failed", message: "" }
      }));
    }), g(this, m, async (e) => {
      this._batchRunning = !0, this._output = "";
      const t = e ? "?force=true" : "", a = await r(this, s, _).call(this, "POST", `/generate/batch${t}`);
      this._batchRunning = !1, a ? (this._output = a.output, l(this, u)?.peek(a.success ? "positive" : "warning", {
        data: {
          headline: a.success ? "Batch complete" : "Batch completed with errors",
          message: ""
        }
      })) : l(this, u)?.peek("danger", {
        data: { headline: "Batch generation failed", message: "" }
      });
    }), this.consumeContext(U, (e) => {
      x(this, f, e);
    }), this.consumeContext(j, (e) => {
      x(this, u, e);
    });
  }
  async connectedCallback() {
    super.connectedCallback(), await r(this, s, C).call(this);
  }
  // -- Render --
  render() {
    return d`
      ${r(this, s, O).call(this)} ${r(this, s, S).call(this)}
      ${r(this, s, E).call(this)}
      ${this._output ? r(this, s, N).call(this) : M}
    `;
  }
};
f = /* @__PURE__ */ new WeakMap();
u = /* @__PURE__ */ new WeakMap();
s = /* @__PURE__ */ new WeakSet();
C = async function() {
  const [e, t] = await Promise.all([
    r(this, s, _).call(this, "GET", "/palettes"),
    r(this, s, _).call(this, "GET", "/articles")
  ]);
  e && (this._palettes = e), t && (this._articles = t);
};
A = async function() {
  return await l(this, f)?.getLatestToken();
};
_ = async function(e, t, a) {
  const i = await r(this, s, A).call(this), o = {
    method: e,
    headers: {
      Authorization: `Bearer ${i}`,
      "Content-Type": "application/json"
    }
  };
  a !== void 0 && (o.body = JSON.stringify(a));
  try {
    const h = await fetch(`${L}${t}`, o);
    return h.ok ? await h.json() : null;
  } catch {
    return null;
  }
};
T = function(e, t, a) {
  const i = { ...this._palettes.entries };
  i[e] = [...i[e]], i[e][t] = B(a), this._palettes = { ...this._palettes, entries: i };
};
G = function(e, t) {
  const a = [...this._palettes.default];
  a[e] = B(t), this._palettes = { ...this._palettes, default: a };
};
P = function(e) {
  const t = { ...this._palettes.entries };
  t[e] = [...t[e], [0, 140, 200]], this._palettes = { ...this._palettes, entries: t };
};
R = function(e, t) {
  const a = { ...this._palettes.entries };
  a[e] = a[e].filter((i, o) => o !== t), this._palettes = { ...this._palettes, entries: a };
};
z = function(e) {
  const t = { ...this._palettes.entries };
  delete t[e], this._palettes = { ...this._palettes, entries: t };
};
I = function() {
  const e = this._newCategoryName.trim();
  if (!e || this._palettes.entries[e]) return;
  const t = { ...this._palettes.entries };
  t[e] = [[0, 140, 200]], this._palettes = { ...this._palettes, entries: t }, this._newCategoryName = "";
};
y = /* @__PURE__ */ new WeakMap();
w = /* @__PURE__ */ new WeakMap();
m = /* @__PURE__ */ new WeakMap();
O = function() {
  const e = Object.entries(this._palettes.entries);
  return d`
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
            ${e.map(
    ([t, a]) => d`
                <tr>
                  <td class="category-name">${t}</td>
                  <td class="color-cells">
                    ${a.map(
      (i, o) => d`
                        <span class="color-slot">
                          <input
                            type="color"
                            .value=${$(i)}
                            @input=${(h) => r(this, s, T).call(this, t, o, h.target.value)}
                          />
                          <uui-button
                            compact
                            look="secondary"
                            label="Remove color"
                            @click=${() => r(this, s, R).call(this, t, o)}
                            >x</uui-button
                          >
                        </span>
                      `
    )}
                    <uui-button
                      compact
                      look="outline"
                      label="Add color"
                      @click=${() => r(this, s, P).call(this, t)}
                      >+</uui-button
                    >
                  </td>
                  <td>
                    <uui-button
                      compact
                      color="danger"
                      look="secondary"
                      label="Remove category"
                      @click=${() => r(this, s, z).call(this, t)}
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
    (t, a) => d`
              <input
                type="color"
                .value=${$(t)}
                @input=${(i) => r(this, s, G).call(this, a, i.target.value)}
              />
            `
  )}
        </div>

        <div class="add-category">
          <uui-input
            label="New category name"
            placeholder="Category name"
            .value=${this._newCategoryName}
            @input=${(t) => {
    this._newCategoryName = t.target.value;
  }}
          ></uui-input>
          <uui-button look="outline" label="Add category" @click=${r(this, s, I)}>
            Add Category
          </uui-button>
        </div>

        <div class="actions">
          <uui-button
            color="positive"
            look="primary"
            label="Save palettes"
            .state=${this._savingPalettes ? "waiting" : void 0}
            @click=${l(this, y)}
          >
            Save Palettes
          </uui-button>
        </div>
      </uui-box>
    `;
};
S = function() {
  return d`
      <uui-box headline="Generate for Article">
        <p>Generate a flow-field image for a single article.</p>

        <div class="form-row">
          <uui-select
            label="Select article"
            .options=${this._articles.map((e) => ({
    name: e.name,
    value: e.id,
    selected: e.id === this._selectedArticleId
  }))}
            @change=${(e) => {
    this._selectedArticleId = e.target.value;
  }}
          ></uui-select>
        </div>

        <div class="form-row">
          <label>
            <uui-toggle
              label="Force regenerate"
              .checked=${this._forceRegenerate}
              @change=${(e) => {
    this._forceRegenerate = e.target.checked;
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
            .state=${this._generating ? "waiting" : void 0}
            ?disabled=${!this._selectedArticleId}
            @click=${l(this, w)}
          >
            Generate Image
          </uui-button>
        </div>
      </uui-box>
    `;
};
E = function() {
  return d`
      <uui-box headline="Batch Generation">
        <p>Generate images for multiple articles at once.</p>

        <div class="actions">
          <uui-button
            look="primary"
            label="Generate missing"
            .state=${this._batchRunning ? "waiting" : void 0}
            @click=${() => l(this, m).call(this, !1)}
          >
            Generate Missing
          </uui-button>
          <uui-button
            color="danger"
            look="secondary"
            label="Regenerate all"
            .state=${this._batchRunning ? "waiting" : void 0}
            @click=${() => l(this, m).call(this, !0)}
          >
            Regenerate All
          </uui-button>
        </div>
      </uui-box>
    `;
};
N = function() {
  return d`
      <uui-box headline="Output">
        <pre class="cli-output">${this._output}</pre>
      </uui-box>
    `;
};
n.styles = [
  D`
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
    `
];
c([
  p()
], n.prototype, "_palettes", 2);
c([
  p()
], n.prototype, "_articles", 2);
c([
  p()
], n.prototype, "_selectedArticleId", 2);
c([
  p()
], n.prototype, "_forceRegenerate", 2);
c([
  p()
], n.prototype, "_generating", 2);
c([
  p()
], n.prototype, "_batchRunning", 2);
c([
  p()
], n.prototype, "_output", 2);
c([
  p()
], n.prototype, "_savingPalettes", 2);
c([
  p()
], n.prototype, "_newCategoryName", 2);
n = c([
  W("image-generator-dashboard")
], n);
export {
  n as default
};
//# sourceMappingURL=dashboard.element-Dz-reJlD.js.map

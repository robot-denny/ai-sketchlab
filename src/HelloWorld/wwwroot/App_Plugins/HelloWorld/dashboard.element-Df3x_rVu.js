import { nothing as $, html as u, css as U, state as d, customElement as j } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as q } from "@umbraco-cms/backoffice/lit-element";
import { UMB_AUTH_CONTEXT as H } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as L } from "@umbraco-cms/backoffice/notification";
var X = Object.defineProperty, J = Object.getOwnPropertyDescriptor, k = (e) => {
  throw TypeError(e);
}, h = (e, a, t, i) => {
  for (var o = i > 1 ? void 0 : i ? J(a, t) : a, n = e.length - 1, f; n >= 0; n--)
    (f = e[n]) && (o = (i ? f(a, t, o) : f(o)) || o);
  return i && o && X(a, t, o), o;
}, b = (e, a, t) => a.has(e) || k("Cannot " + t), l = (e, a, t) => (b(e, a, "read from private field"), t ? t.call(e) : a.get(e)), _ = (e, a, t) => a.has(e) ? k("Cannot add the same private member more than once") : a instanceof WeakSet ? a.add(e) : a.set(e, t), x = (e, a, t, i) => (b(e, a, "write to private field"), a.set(e, t), t), r = (e, a, t) => (b(e, a, "access private method"), t), m, p, s, I, S, T, g, A, G, P, R, z, O, N, E, y, w, v, M, B, D, W;
const F = (e) => {
  const a = parseInt(e.slice(1), 16);
  return [a >> 16 & 255, a >> 8 & 255, a & 255];
}, C = ([e, a, t]) => "#" + [e, a, t].map((i) => i.toString(16).padStart(2, "0")).join(""), K = "/umbraco/api/image-generator";
let c = class extends q {
  constructor() {
    super(), _(this, s), this._palettes = { entries: {}, default: [] }, this._articles = [], this._categories = [], this._selectedArticleId = "", this._selectedNewCategoryId = "", this._forceRegenerate = !1, this._generating = !1, this._batchRunning = !1, this._output = "", this._savingPalettes = !1, _(this, m), _(this, p), _(this, y, async () => {
      this._savingPalettes = !0;
      const e = await r(this, s, g).call(this, "PUT", "/palettes", this._palettes);
      this._savingPalettes = !1, e?.success ? l(this, p)?.peek("positive", {
        data: { headline: "Palettes saved", message: "" }
      }) : l(this, p)?.peek("danger", {
        data: { headline: "Failed to save palettes", message: "" }
      });
    }), _(this, w, async () => {
      if (!this._selectedArticleId) return;
      this._generating = !0, this._output = "";
      const e = this._forceRegenerate ? "?force=true" : "", a = await r(this, s, g).call(this, "POST", `/generate/${this._selectedArticleId}${e}`);
      this._generating = !1, a?.success ? (this._output = a.output, l(this, p)?.peek("positive", {
        data: {
          headline: "Image generated",
          message: "Reload the article to see the new image."
        }
      })) : (this._output = a?.output ?? "Generation failed", l(this, p)?.peek("danger", {
        data: { headline: "Generation failed", message: "" }
      }));
    }), _(this, v, async (e) => {
      this._batchRunning = !0, this._output = "";
      const a = e ? "?force=true" : "", t = await r(this, s, g).call(this, "POST", `/generate/batch${a}`);
      this._batchRunning = !1, t ? (this._output = t.output, l(this, p)?.peek(t.success ? "positive" : "warning", {
        data: {
          headline: t.success ? "Batch complete" : "Batch completed with errors",
          message: ""
        }
      })) : l(this, p)?.peek("danger", {
        data: { headline: "Batch generation failed", message: "" }
      });
    }), this.consumeContext(H, (e) => {
      x(this, m, e);
    }), this.consumeContext(L, (e) => {
      x(this, p, e);
    });
  }
  async connectedCallback() {
    super.connectedCallback(), await r(this, s, I).call(this);
  }
  // -- Render --
  render() {
    return u`
      ${r(this, s, M).call(this)} ${r(this, s, B).call(this)}
      ${r(this, s, D).call(this)}
      ${this._output ? r(this, s, W).call(this) : $}
    `;
  }
};
m = /* @__PURE__ */ new WeakMap();
p = /* @__PURE__ */ new WeakMap();
s = /* @__PURE__ */ new WeakSet();
I = async function() {
  const [e, a, t] = await Promise.all([
    r(this, s, g).call(this, "GET", "/palettes"),
    r(this, s, g).call(this, "GET", "/articles"),
    r(this, s, g).call(this, "GET", "/categories")
  ]);
  e && (this._palettes = e), a && (this._articles = a), t && (this._categories = t), r(this, s, S).call(this);
};
S = function() {
  const e = new Map(this._categories.map((i) => [i.id, i.name]));
  let a = !1;
  const t = { ...this._palettes.entries };
  for (const [i, o] of Object.entries(t)) {
    const n = e.get(i);
    n && n !== o.name && (t[i] = { ...o, name: n }, a = !0);
  }
  a && (this._palettes = { ...this._palettes, entries: t }, l(this, p)?.peek("warning", {
    data: {
      headline: "Category names updated",
      message: "Some categories were renamed in the CMS. Save palettes to persist the updated names."
    }
  }));
};
T = async function() {
  return await l(this, m)?.getLatestToken();
};
g = async function(e, a, t) {
  const i = await r(this, s, T).call(this), o = {
    method: e,
    headers: {
      Authorization: `Bearer ${i}`,
      "Content-Type": "application/json"
    }
  };
  t !== void 0 && (o.body = JSON.stringify(t));
  try {
    const n = await fetch(`${K}${a}`, o);
    return n.ok ? await n.json() : null;
  } catch {
    return null;
  }
};
A = function() {
  return this._categories.filter((e) => !this._palettes.entries[e.id]);
};
G = function(e) {
  return !this._categories.some((a) => a.id === e);
};
P = function(e, a, t) {
  const i = { ...this._palettes.entries }, o = i[e], n = [...o.colors];
  n[a] = F(t), i[e] = { ...o, colors: n }, this._palettes = { ...this._palettes, entries: i };
};
R = function(e, a) {
  const t = [...this._palettes.default];
  t[e] = F(a), this._palettes = { ...this._palettes, default: t };
};
z = function(e) {
  const a = { ...this._palettes.entries }, t = a[e];
  a[e] = { ...t, colors: [...t.colors, [0, 140, 200]] }, this._palettes = { ...this._palettes, entries: a };
};
O = function(e, a) {
  const t = { ...this._palettes.entries }, i = t[e];
  t[e] = { ...i, colors: i.colors.filter((o, n) => n !== a) }, this._palettes = { ...this._palettes, entries: t };
};
N = function(e) {
  const a = { ...this._palettes.entries };
  delete a[e], this._palettes = { ...this._palettes, entries: a };
};
E = function() {
  const e = this._selectedNewCategoryId;
  if (!e || this._palettes.entries[e]) return;
  const a = this._categories.find((i) => i.id === e);
  if (!a) return;
  const t = { ...this._palettes.entries };
  t[e] = { name: a.name, colors: [[0, 140, 200]] }, this._palettes = { ...this._palettes, entries: t }, this._selectedNewCategoryId = "";
};
y = /* @__PURE__ */ new WeakMap();
w = /* @__PURE__ */ new WeakMap();
v = /* @__PURE__ */ new WeakMap();
M = function() {
  const e = Object.entries(this._palettes.entries), a = l(this, s, A);
  return u`
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
    ([t, i]) => u`
                <tr>
                  <td class="category-name">
                    ${i.name}
                    ${r(this, s, G).call(this, t) ? u`<span class="orphan-badge" title="This category no longer exists in the CMS">Deleted</span>` : $}
                  </td>
                  <td class="color-cells">
                    ${i.colors.map(
      (o, n) => u`
                        <span class="color-slot">
                          <input
                            type="color"
                            .value=${C(o)}
                            @input=${(f) => r(this, s, P).call(this, t, n, f.target.value)}
                          />
                          <uui-button
                            compact
                            look="secondary"
                            label="Remove color"
                            @click=${() => r(this, s, O).call(this, t, n)}
                            >x</uui-button
                          >
                        </span>
                      `
    )}
                    <uui-button
                      compact
                      look="outline"
                      label="Add color"
                      @click=${() => r(this, s, z).call(this, t)}
                      >+</uui-button
                    >
                  </td>
                  <td>
                    <uui-button
                      compact
                      color="danger"
                      look="secondary"
                      label="Remove category"
                      @click=${() => r(this, s, N).call(this, t)}
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
    (t, i) => u`
              <input
                type="color"
                .value=${C(t)}
                @input=${(o) => r(this, s, R).call(this, i, o.target.value)}
              />
            `
  )}
        </div>

        <div class="add-category">
          ${a.length > 0 ? u`
                <uui-select
                  label="Select category"
                  placeholder="Select a category..."
                  .options=${[
    { name: "Select a category...", value: "", selected: !this._selectedNewCategoryId },
    ...a.map((t) => ({
      name: t.name,
      value: t.id,
      selected: t.id === this._selectedNewCategoryId
    }))
  ]}
                  @change=${(t) => {
    this._selectedNewCategoryId = t.target.value;
  }}
                ></uui-select>
                <uui-button
                  look="outline"
                  label="Add category"
                  ?disabled=${!this._selectedNewCategoryId}
                  @click=${r(this, s, E)}
                >
                  Add Category
                </uui-button>
              ` : u`<em>All categories have palette entries assigned.</em>`}
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
B = function() {
  return u`
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
D = function() {
  return u`
      <uui-box headline="Batch Generation">
        <p>Generate images for multiple articles at once.</p>

        <div class="actions">
          <uui-button
            look="primary"
            label="Generate missing"
            .state=${this._batchRunning ? "waiting" : void 0}
            @click=${() => l(this, v).call(this, !1)}
          >
            Generate Missing
          </uui-button>
          <uui-button
            color="danger"
            look="secondary"
            label="Regenerate all"
            .state=${this._batchRunning ? "waiting" : void 0}
            @click=${() => l(this, v).call(this, !0)}
          >
            Regenerate All
          </uui-button>
        </div>
      </uui-box>
    `;
};
W = function() {
  return u`
      <uui-box headline="Output">
        <pre class="cli-output">${this._output}</pre>
      </uui-box>
    `;
};
c.styles = [
  U`
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
    `
];
h([
  d()
], c.prototype, "_palettes", 2);
h([
  d()
], c.prototype, "_articles", 2);
h([
  d()
], c.prototype, "_categories", 2);
h([
  d()
], c.prototype, "_selectedArticleId", 2);
h([
  d()
], c.prototype, "_selectedNewCategoryId", 2);
h([
  d()
], c.prototype, "_forceRegenerate", 2);
h([
  d()
], c.prototype, "_generating", 2);
h([
  d()
], c.prototype, "_batchRunning", 2);
h([
  d()
], c.prototype, "_output", 2);
h([
  d()
], c.prototype, "_savingPalettes", 2);
c = h([
  j("image-generator-dashboard")
], c);
export {
  c as default
};
//# sourceMappingURL=dashboard.element-Df3x_rVu.js.map

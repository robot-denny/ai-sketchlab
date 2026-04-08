import { nothing as O, html as g, css as R, state as p, customElement as T } from "@umbraco-cms/backoffice/external/lit";
import { UmbLitElement as S } from "@umbraco-cms/backoffice/lit-element";
import { UMB_AUTH_CONTEXT as B } from "@umbraco-cms/backoffice/auth";
import { UMB_NOTIFICATION_CONTEXT as E } from "@umbraco-cms/backoffice/notification";
var P = Object.defineProperty, z = Object.getOwnPropertyDescriptor, k = (e) => {
  throw TypeError(e);
}, u = (e, t, a, l) => {
  for (var r = l > 1 ? void 0 : l ? z(t, a) : t, h = e.length - 1, v; h >= 0; h--)
    (v = e[h]) && (r = (l ? v(t, a, r) : v(r)) || r);
  return l && r && P(t, a, r), r;
}, b = (e, t, a) => t.has(e) || k("Cannot " + a), o = (e, t, a) => (b(e, t, "read from private field"), t.get(e)), d = (e, t, a) => t.has(e) ? k("Cannot add the same private member more than once") : t instanceof WeakSet ? t.add(e) : t.set(e, a), y = (e, t, a, l) => (b(e, t, "write to private field"), t.set(e, a), a), s = (e, t, a) => (b(e, t, "access private method"), a), _, c, i, x, $, f, w, m, G, I, C, A;
const M = "/umbraco/api/image-generator";
let n = class extends S {
  constructor() {
    super(), d(this, i), this._articles = [], this._selectedArticleId = "", this._forceRegenerate = !1, this._generating = !1, this._batchRunning = !1, this._output = "", d(this, _), d(this, c), d(this, w, async () => {
      if (!this._selectedArticleId) return;
      this._generating = !0, this._output = "";
      const e = this._forceRegenerate ? "?force=true" : "", t = await s(this, i, f).call(this, "POST", `/generate/${this._selectedArticleId}${e}`);
      this._generating = !1, t?.success ? (this._output = t.output, o(this, c)?.peek("positive", {
        data: {
          headline: "Image generated",
          message: "Reload the article to see the new image."
        }
      })) : (this._output = t?.output ?? "Generation failed", o(this, c)?.peek("danger", {
        data: { headline: "Generation failed", message: "" }
      }));
    }), d(this, m, async (e) => {
      this._batchRunning = !0, this._output = "";
      const t = e ? "?force=true" : "", a = await s(this, i, f).call(this, "POST", `/generate/batch${t}`);
      this._batchRunning = !1, a ? (this._output = a.output, o(this, c)?.peek(a.success ? "positive" : "warning", {
        data: {
          headline: a.success ? "Batch complete" : "Batch completed with errors",
          message: ""
        }
      })) : o(this, c)?.peek("danger", {
        data: { headline: "Batch generation failed", message: "" }
      });
    }), this.consumeContext(B, (e) => {
      y(this, _, e);
    }), this.consumeContext(E, (e) => {
      y(this, c, e);
    });
  }
  async connectedCallback() {
    super.connectedCallback(), await s(this, i, x).call(this);
  }
  // -- Render --
  render() {
    return g`
      ${s(this, i, G).call(this)} ${s(this, i, I).call(this)}
      ${s(this, i, C).call(this)}
      ${this._output ? s(this, i, A).call(this) : O}
    `;
  }
};
_ = /* @__PURE__ */ new WeakMap();
c = /* @__PURE__ */ new WeakMap();
i = /* @__PURE__ */ new WeakSet();
x = async function() {
  const e = await s(this, i, f).call(this, "GET", "/articles");
  e && (this._articles = e);
};
$ = async function() {
  return await o(this, _)?.getLatestToken();
};
f = async function(e, t, a) {
  const l = await s(this, i, $).call(this), r = {
    method: e,
    headers: {
      Authorization: `Bearer ${l}`,
      "Content-Type": "application/json"
    }
  };
  a !== void 0 && (r.body = JSON.stringify(a));
  try {
    const h = await fetch(`${M}${t}`, r);
    return h.ok ? await h.json() : null;
  } catch {
    return null;
  }
};
w = /* @__PURE__ */ new WeakMap();
m = /* @__PURE__ */ new WeakMap();
G = function() {
  return g`
      <uui-box headline="Palette Settings">
        <p>
          Category color palettes are managed in the content tree:
          <strong>Home → Site Settings → Image Generator Settings</strong>.
          Open the settings document to add, edit, or remove category palette entries.
        </p>
      </uui-box>
    `;
};
I = function() {
  return g`
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
            @click=${o(this, w)}
          >
            Generate Image
          </uui-button>
        </div>
      </uui-box>
    `;
};
C = function() {
  return g`
      <uui-box headline="Batch Generation">
        <p>Generate images for multiple articles at once.</p>

        <div class="actions">
          <uui-button
            look="primary"
            label="Generate missing"
            .state=${this._batchRunning ? "waiting" : void 0}
            @click=${() => o(this, m).call(this, !1)}
          >
            Generate Missing
          </uui-button>
          <uui-button
            color="danger"
            look="secondary"
            label="Regenerate all"
            .state=${this._batchRunning ? "waiting" : void 0}
            @click=${() => o(this, m).call(this, !0)}
          >
            Regenerate All
          </uui-button>
        </div>
      </uui-box>
    `;
};
A = function() {
  return g`
      <uui-box headline="Output">
        <pre class="cli-output" role="region" aria-label="Command output" tabindex="0">${this._output}</pre>
      </uui-box>
    `;
};
n.styles = [
  R`
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
    `
];
u([
  p()
], n.prototype, "_articles", 2);
u([
  p()
], n.prototype, "_selectedArticleId", 2);
u([
  p()
], n.prototype, "_forceRegenerate", 2);
u([
  p()
], n.prototype, "_generating", 2);
u([
  p()
], n.prototype, "_batchRunning", 2);
u([
  p()
], n.prototype, "_output", 2);
n = u([
  T("image-generator-dashboard")
], n);
export {
  n as default
};
//# sourceMappingURL=dashboard.element-BhkczKEX.js.map

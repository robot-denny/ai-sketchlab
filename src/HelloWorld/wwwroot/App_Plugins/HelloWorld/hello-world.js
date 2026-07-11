const e = [
  {
    name: "Hello World Entrypoint",
    alias: "HelloWorld.Entrypoint",
    type: "backofficeEntryPoint",
    js: () => import("./entrypoint-DOe2Kklk.js")
  }
], a = [
  {
    name: "Hello World Dashboard",
    alias: "HelloWorld.Dashboard",
    type: "dashboard",
    js: () => import("./dashboard.element-BTRF1_7_.js"),
    meta: {
      label: "Example Dashboard",
      pathname: "example-dashboard"
    },
    conditions: [
      {
        alias: "Umb.Condition.SectionAlias",
        match: "Umb.Section.Content"
      }
    ]
  }
], t = [
  {
    name: "Image Generator Dashboard",
    alias: "ImageGenerator.Dashboard",
    type: "dashboard",
    element: () => import("./dashboard.element-BhkczKEX.js"),
    meta: {
      label: "Image Generator",
      pathname: "image-generator"
    },
    conditions: [
      {
        alias: "Umb.Condition.SectionAlias",
        match: "Umb.Section.Settings"
      }
    ]
  }
], o = [
  {
    type: "propertyAction",
    kind: "default",
    alias: "ImageGenerator.PropertyAction.Generate",
    name: "Generate Flow Field Image",
    api: () => import("./generateImage.action-DmjEez86.js"),
    forPropertyEditorUis: ["Umb.PropertyEditorUi.MediaPicker"],
    weight: 100,
    meta: {
      icon: "icon-wand",
      label: "Generate Image"
    }
  }
], n = [
  {
    type: "tiptapToolbarExtension",
    kind: "styleMenu",
    alias: "Site.Tiptap.Toolbar.StyleSelect",
    name: "Site Style Select Tiptap Extension",
    overwrites: "Umb.Tiptap.Toolbar.StyleSelect",
    forExtensions: [
      "Umb.Tiptap.Heading",
      "Umb.Tiptap.Blockquote",
      "Umb.Tiptap.CodeBlock"
    ],
    items: [
      {
        label: "Headers",
        items: [
          {
            label: "Page header",
            appearance: { icon: "icon-heading-2", style: "font-size: x-large;font-weight: bold;" },
            data: { tag: "h2" }
          },
          {
            label: "Section header",
            appearance: { icon: "icon-heading-3", style: "font-size: large;font-weight: bold;" },
            data: { tag: "h3" }
          },
          {
            label: "Paragraph header",
            appearance: { icon: "icon-heading-4", style: "font-weight: bold;" },
            data: { tag: "h4" }
          },
          {
            label: "Minor header",
            appearance: { icon: "icon-heading-5", style: "font-weight: bold;" },
            data: { tag: "h5" }
          },
          {
            label: "Fine header",
            appearance: { icon: "icon-heading-6", style: "font-weight: bold;" },
            data: { tag: "h6" }
          }
        ]
      },
      {
        label: "Editorial",
        items: [
          {
            label: "Lead paragraph",
            appearance: { icon: "icon-paragraph", style: "font-size: 1.15em;font-weight: 300;" },
            data: { tag: "p", class: "lead" }
          },
          {
            label: "Overline",
            appearance: { icon: "icon-tags", style: "text-transform: uppercase;letter-spacing: 0.06em;font-size: 0.85em;font-weight: 700;" },
            data: { tag: "p", class: "overline" }
          },
          {
            label: "Pull quote",
            appearance: { icon: "icon-quote", style: "font-style: italic;text-align: center;" },
            data: { tag: "p", class: "pull-quote" }
          },
          {
            // Toolbar-preview style only (approximates the rendered .pull-quote-accent;
            // exact parity not needed). #C23D2E = --accent-primary — keep in sync with
            // assets/css/typography.css and wwwroot/css/dropdownStyles.css.
            label: "Pull quote (accent)",
            appearance: { icon: "icon-quote", style: "font-style: italic;border-left: 3px solid #C23D2E;padding-left: 8px;" },
            data: { tag: "p", class: "pull-quote-accent" }
          },
          {
            label: "Caption",
            appearance: { icon: "icon-document", style: "font-size: 0.85em;font-style: italic;" },
            data: { tag: "p", class: "caption" }
          }
        ]
      },
      {
        label: "Blocks",
        items: [{ label: "Paragraph", appearance: { icon: "icon-paragraph" }, data: { tag: "p" } }]
      },
      {
        label: "Containers",
        items: [
          {
            label: "Block quote",
            appearance: { icon: "icon-blockquote", style: "font-style: italic;" },
            data: { tag: "blockquote" }
          },
          {
            label: "Code block",
            appearance: { icon: "icon-code", style: "font-family: monospace;" },
            data: { tag: "codeBlock" }
          }
        ]
      }
    ],
    meta: {
      alias: "siteStyleSelect",
      icon: "icon-palette",
      label: "Style Select"
    }
  }
], i = n, l = [
  ...e,
  ...a,
  ...t,
  ...o,
  ...i
];
export {
  l as manifests
};
//# sourceMappingURL=hello-world.js.map

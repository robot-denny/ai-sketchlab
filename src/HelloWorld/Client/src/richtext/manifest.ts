// Custom TipTap Style Select for the rich-text editor.
//
// The TipTap-based rich-text editor in Umbraco 17 no longer parses
// `/**umb_name:Label*/` annotations from stylesheets (that was a TinyMCE
// convention). Style Menu entries must be declared as a manifest extension.
//
// `overwrites` replaces the built-in `Umb.Tiptap.Toolbar.StyleSelect`, so the
// data type config doesn't need to change — it continues to reference the
// built-in alias and our manifest takes the slot. (Cast widens the TipTap
// manifest type, which doesn't declare `overwrites` even though the
// extension registry respects it at runtime.)

const richtextManifests: Array<UmbExtensionManifest & { overwrites?: string }> = [
  {
    type: "tiptapToolbarExtension",
    kind: "styleMenu",
    alias: "Site.Tiptap.Toolbar.StyleSelect",
    name: "Site Style Select Tiptap Extension",
    overwrites: "Umb.Tiptap.Toolbar.StyleSelect",
    forExtensions: [
      "Umb.Tiptap.Heading",
      "Umb.Tiptap.Blockquote",
      "Umb.Tiptap.CodeBlock",
    ],
    items: [
      {
        label: "Headers",
        items: [
          {
            label: "Page header",
            appearance: { icon: "icon-heading-2", style: "font-size: x-large;font-weight: bold;" },
            data: { tag: "h2" },
          },
          {
            label: "Section header",
            appearance: { icon: "icon-heading-3", style: "font-size: large;font-weight: bold;" },
            data: { tag: "h3" },
          },
          {
            label: "Paragraph header",
            appearance: { icon: "icon-heading-4", style: "font-weight: bold;" },
            data: { tag: "h4" },
          },
          {
            label: "Minor header",
            appearance: { icon: "icon-heading-5", style: "font-weight: bold;" },
            data: { tag: "h5" },
          },
          {
            label: "Fine header",
            appearance: { icon: "icon-heading-6", style: "font-weight: bold;" },
            data: { tag: "h6" },
          },
        ],
      },
      {
        label: "Editorial",
        items: [
          {
            label: "Lead paragraph",
            appearance: { icon: "icon-paragraph", style: "font-size: 1.15em;font-weight: 300;" },
            data: { tag: "p", class: "lead" },
          },
          {
            label: "Overline",
            appearance: { icon: "icon-tags", style: "text-transform: uppercase;letter-spacing: 0.06em;font-size: 0.85em;font-weight: 700;" },
            data: { tag: "p", class: "overline" },
          },
          {
            label: "Pull quote",
            appearance: { icon: "icon-quote", style: "font-style: italic;text-align: center;" },
            data: { tag: "p", class: "pull-quote" },
          },
          {
            label: "Caption",
            appearance: { icon: "icon-document", style: "font-size: 0.85em;font-style: italic;" },
            data: { tag: "p", class: "caption" },
          },
        ],
      },
      {
        label: "Blocks",
        items: [{ label: "Paragraph", appearance: { icon: "icon-paragraph" }, data: { tag: "p" } }],
      },
      {
        label: "Containers",
        items: [
          {
            label: "Block quote",
            appearance: { icon: "icon-blockquote", style: "font-style: italic;" },
            data: { tag: "blockquote" },
          },
          {
            label: "Code block",
            appearance: { icon: "icon-code", style: "font-family: monospace;" },
            data: { tag: "codeBlock" },
          },
        ],
      },
    ],
    meta: {
      alias: "siteStyleSelect",
      icon: "icon-palette",
      label: "Style Select",
    },
  },
];

export const manifests: Array<UmbExtensionManifest> = richtextManifests as Array<UmbExtensionManifest>;

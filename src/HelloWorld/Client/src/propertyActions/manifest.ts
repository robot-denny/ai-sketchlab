export const manifests: Array<UmbExtensionManifest> = [
  {
    type: "propertyAction",
    kind: "default",
    alias: "ImageGenerator.PropertyAction.Generate",
    name: "Generate Flow Field Image",
    api: () => import("./generateImage.action.js"),
    forPropertyEditorUis: ["Umb.PropertyEditorUi.MediaPicker"],
    weight: 100,
    meta: {
      icon: "icon-wand",
      label: "Generate Image",
    },
  },
];

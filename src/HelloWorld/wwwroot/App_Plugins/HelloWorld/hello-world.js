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
    element: () => import("./dashboard.element-Df3x_rVu.js"),
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
  ...e,
  ...a,
  ...t,
  ...o
];
export {
  n as manifests
};
//# sourceMappingURL=hello-world.js.map

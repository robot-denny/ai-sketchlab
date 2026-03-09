export const manifests: Array<UmbExtensionManifest> = [
  {
    name: "Image Generator Dashboard",
    alias: "ImageGenerator.Dashboard",
    type: "dashboard",
    element: () => import("./dashboard.element.js"),
    meta: {
      label: "Image Generator",
      pathname: "image-generator",
    },
    conditions: [
      {
        alias: "Umb.Condition.SectionAlias",
        match: "Umb.Section.Settings",
      },
    ],
  },
];

export const manifests: Array<UmbExtensionManifest> = [
  {
    name: "Hello World Entrypoint",
    alias: "HelloWorld.Entrypoint",
    type: "backofficeEntryPoint",
    js: () => import("./entrypoint.js"),
  },
];

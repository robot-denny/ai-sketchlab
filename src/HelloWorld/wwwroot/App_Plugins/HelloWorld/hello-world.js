const a = [
  {
    name: "Hello World Entrypoint",
    alias: "HelloWorld.Entrypoint",
    type: "backofficeEntryPoint",
    js: () => import("./entrypoint-DOe2Kklk.js")
  }
], o = [
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
  ...a,
  ...o
];
export {
  t as manifests
};
//# sourceMappingURL=hello-world.js.map

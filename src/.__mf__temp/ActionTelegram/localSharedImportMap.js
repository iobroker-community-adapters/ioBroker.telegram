
// Windows temporarily needs this file, https://github.com/module-federation/vite/issues/68

    const importMap = {
      
        "@iobroker/adapter-react-v5": async () => {
          let pkg = await import("__mf__virtual/ActionTelegram__prebuild___mf_0_iobroker_mf_1_adapter_mf_2_react_mf_2_v5__prebuild__.js")
          return pkg
        }
      ,
        "react": async () => {
          let pkg = await import("__mf__virtual/ActionTelegram__prebuild__react__prebuild__.js")
          return pkg
        }
      ,
        "react-dom": async () => {
          let pkg = await import("__mf__virtual/ActionTelegram__prebuild__react_mf_2_dom__prebuild__.js")
          return pkg
        }
      ,
        "prop-types": async () => {
          let pkg = await import("__mf__virtual/ActionTelegram__prebuild__prop_mf_2_types__prebuild__.js")
          return pkg
        }
      
    }
      const usedShared = {
      
          "@iobroker/adapter-react-v5": {
            name: "@iobroker/adapter-react-v5",
            version: "7.4.12",
            scope: ["default"],
            loaded: false,
            from: "ActionTelegram",
            async get () {
              usedShared["@iobroker/adapter-react-v5"].loaded = true
              const {"@iobroker/adapter-react-v5": pkgDynamicImport} = importMap 
              const res = await pkgDynamicImport()
              const exportModule = {...res}
              // All npm packages pre-built by vite will be converted to esm
              Object.defineProperty(exportModule, "__esModule", {
                value: true,
                enumerable: false
              })
              return function () {
                return exportModule
              }
            },
            shareConfig: {
              singleton: true,
              requiredVersion: "*"
            }
          }
        ,
          "react": {
            name: "react",
            version: "18.3.1",
            scope: ["default"],
            loaded: false,
            from: "ActionTelegram",
            async get () {
              usedShared["react"].loaded = true
              const {"react": pkgDynamicImport} = importMap 
              const res = await pkgDynamicImport()
              const exportModule = {...res}
              // All npm packages pre-built by vite will be converted to esm
              Object.defineProperty(exportModule, "__esModule", {
                value: true,
                enumerable: false
              })
              return function () {
                return exportModule
              }
            },
            shareConfig: {
              singleton: true,
              requiredVersion: "*"
            }
          }
        ,
          "react-dom": {
            name: "react-dom",
            version: "18.3.1",
            scope: ["default"],
            loaded: false,
            from: "ActionTelegram",
            async get () {
              usedShared["react-dom"].loaded = true
              const {"react-dom": pkgDynamicImport} = importMap 
              const res = await pkgDynamicImport()
              const exportModule = {...res}
              // All npm packages pre-built by vite will be converted to esm
              Object.defineProperty(exportModule, "__esModule", {
                value: true,
                enumerable: false
              })
              return function () {
                return exportModule
              }
            },
            shareConfig: {
              singleton: true,
              requiredVersion: "*"
            }
          }
        ,
          "prop-types": {
            name: "prop-types",
            version: "15.8.1",
            scope: ["default"],
            loaded: false,
            from: "ActionTelegram",
            async get () {
              usedShared["prop-types"].loaded = true
              const {"prop-types": pkgDynamicImport} = importMap 
              const res = await pkgDynamicImport()
              const exportModule = {...res}
              // All npm packages pre-built by vite will be converted to esm
              Object.defineProperty(exportModule, "__esModule", {
                value: true,
                enumerable: false
              })
              return function () {
                return exportModule
              }
            },
            shareConfig: {
              singleton: true,
              requiredVersion: "*"
            }
          }
        
    }
      const usedRemotes = [
      ]
      export {
        usedShared,
        usedRemotes
      }
      
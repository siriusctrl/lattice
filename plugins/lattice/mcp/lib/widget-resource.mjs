import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
} from "@modelcontextprotocol/ext-apps/server";

const require = createRequire(import.meta.url);
let cachedAppsBundle = "";

export function registerWidgetResource(
  server,
  { name, uri, title, description, html, prefersBorder = false },
) {
  const metadata = {
    ui: {
      prefersBorder,
      csp: {
        connectDomains: [],
        resourceDomains: [],
      },
    },
    "openai/widgetDescription": description,
    "openai/widgetPrefersBorder": prefersBorder,
    "openai/widgetCSP": {
      connect_domains: [],
      resource_domains: [],
    },
  };

  registerAppResource(
    server,
    name,
    uri,
    {
      title,
      description,
      _meta: metadata,
    },
    async () => ({
      contents: [
        {
          uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: injectHostBridge(typeof html === "function" ? await html() : html),
          _meta: metadata,
        },
      ],
    }),
  );
}

function appsBundle() {
  if (cachedAppsBundle) return cachedAppsBundle;
  const sourcePath = require.resolve("@modelcontextprotocol/ext-apps/app-with-deps");
  const source = readFileSync(sourcePath, "utf8");
  const exportStart = source.lastIndexOf("export{");
  if (exportStart === -1) throw new Error("Could not find ext-apps browser export block.");
  const exportBlock = source.slice(exportStart).match(/^export\{([^}]+)\};?\s*$/s);
  if (!exportBlock) throw new Error("Could not parse ext-apps browser export block.");

  const exportMap = new Map();
  for (const rawEntry of exportBlock[1].split(",")) {
    const parts = rawEntry.trim().split(/\s+as\s+/);
    if (parts[0]) exportMap.set((parts[1] || parts[0]).trim(), parts[0].trim());
  }
  const names = [
    "App",
    "applyDocumentTheme",
    "applyHostFonts",
    "applyHostStyleVariables",
  ];
  for (const name of names) {
    if (!exportMap.has(name)) throw new Error(`Missing ext-apps browser export: ${name}`);
  }

  cachedAppsBundle = [
    source.slice(0, exportStart),
    ";globalThis.__LATTICE_MCP_APPS__={",
    names.map((name) => `${JSON.stringify(name)}:${exportMap.get(name)}`).join(","),
    "};",
  ].join("");
  return cachedAppsBundle;
}

function escapeInlineScript(source) {
  return source.replaceAll("</script", "<\\/script").replaceAll("</SCRIPT", "<\\/SCRIPT");
}

function injectHostBridge(html) {
  const bridge = [
    '<script id="latticeMcpAppsBundle">',
    escapeInlineScript(appsBundle()),
    "</script>",
    '<script id="latticeMcpHostBridge">',
    hostBridgeScript(),
    "</script>",
  ].join("\n");
  return html.includes("</head>")
    ? html.replace("</head>", () => `${bridge}\n</head>`)
    : `${bridge}\n${html}`;
}

function hostBridgeScript() {
  return `(() => {
  "use strict";
  const apps = globalThis.__LATTICE_MCP_APPS__;
  if (!apps || typeof apps.App !== "function") return;
  let app = null;

  function publish(globals) {
    window.openai = Object.assign(window.openai || {}, globals);
    window.dispatchEvent(new CustomEvent("openai:set_globals", {
      detail: { globals: window.openai },
    }));
  }

  function applyHostContext(context) {
    if (!context) return;
    try {
      if (context.theme) apps.applyDocumentTheme?.(context.theme);
      if (context.styles?.variables) apps.applyHostStyleVariables?.(context.styles.variables);
      if (context.styles?.css?.fonts) apps.applyHostFonts?.(context.styles.css.fonts);
    } catch (_error) {}
    publish({
      hostContext: context,
      displayMode: context.displayMode,
      availableDisplayModes: context.availableDisplayModes,
      widgetInstanceId: context.widgetInstanceId || context.widgetId,
    });
  }

  function withTimeout(promise, ms, message) {
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
  }

  async function ready() {
    if (app?.ready) await withTimeout(app.ready, 5000, "Lattice host bridge did not become ready.");
    if (globalThis.__LATTICE_MCP_HOST_ERROR__) throw globalThis.__LATTICE_MCP_HOST_ERROR__;
  }

  function installApi() {
    const api = window.latticeMcp || {};
    window.latticeMcp = api;
    api.callServerTool = async (request, options = {}) => {
      if (!app?.callServerTool) throw new Error("Host tool bridge is unavailable.");
      await ready();
      return withTimeout(
        app.callServerTool(request, options),
        options.timeoutMs || 30000,
        "Lattice server tool call timed out.",
      );
    };
    api.sendMessage = async (message) => {
      const prompt = typeof message === "string" ? message : message?.prompt;
      if (!prompt) throw new Error("Missing Lattice prompt.");
      if (!app?.sendMessage) throw new Error("Host message bridge is unavailable.");
      await ready();
      const result = await withTimeout(app.sendMessage({
        role: "user",
        content: [{ type: "text", text: String(prompt) }],
      }), 10000, "Host did not accept the Lattice prompt.");
      if (result?.isError) throw new Error("Host rejected the Lattice prompt.");
      return result || {};
    };
    api.requestDisplayMode = async (mode) => {
      if (!app?.requestDisplayMode) return {};
      await ready();
      return app.requestDisplayMode({ mode });
    };
    api.getHostCapabilities = () => app?.getHostCapabilities?.() || null;
  }

  function handleToolResult(result) {
    const metadata = result?._meta || {};
    publish({
      rawToolResult: result,
      toolOutput: metadata.widgetData || result?.structuredContent || result || {},
      toolResponseMetadata: metadata,
    });
  }

  try {
    app = new apps.App(
      { name: "lattice", version: "0.1.0" },
      { availableDisplayModes: ["inline", "fullscreen"] },
      { autoResize: true },
    );
    installApi();
    app.addEventListener("hostcontextchanged", applyHostContext);
    app.addEventListener("toolresult", handleToolResult);
    app.ready = app.connect().then(async () => {
      installApi();
      publish({
        hostCapabilities: app.getHostCapabilities?.(),
        hostInfo: app.getHostVersion?.(),
      });
      applyHostContext(app.getHostContext?.());
      try {
        return await app.requestDisplayMode?.({ mode: "fullscreen" });
      } catch (error) {
        // Fullscreen is a preference, not a connection requirement. Hosts that
        // support only inline rendering must retain a working tool bridge.
        publish({ displayModeError: String(error?.message || error) });
        return {};
      }
    }).catch((error) => {
      globalThis.__LATTICE_MCP_HOST_ERROR__ = error;
      publish({ hostBridgeError: String(error?.message || error) });
    });
  } catch (error) {
    globalThis.__LATTICE_MCP_HOST_ERROR__ = error;
  }
})();`;
}

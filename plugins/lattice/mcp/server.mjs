import { readFileSync } from "node:fs";

import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { pluginPath } from "./lib/plugin-root.mjs";
import {
  applyLatticePatch,
  createLatticeWorkspace,
  listLatticeWorkspaces,
  readLatticeState,
  saveLatticeUiState,
} from "./lib/storage.mjs";
import { latticeStaticHtml } from "./lib/static-widget.mjs";
import { registerWidgetResource } from "./lib/widget-resource.mjs";

const WIDGET_URI = "ui://widget/lattice/workspace.html";
const DEFAULT_DISPLAY_MODE = "fullscreen";
const TOOL_RENDER = "render_lattice_workspace";
const TOOL_LIST = "list_lattice_workspaces";
const TOOL_CREATE = "create_lattice_workspace";
const TOOL_GET = "get_lattice_workspace";
const TOOL_APPLY = "apply_lattice_research_patch";
const TOOL_SAVE_UI = "save_lattice_ui_state";

const projectSchema = {
  projectDir: z.string().trim().min(1).describe("Absolute path to the user's active project."),
};
const idSchema = z.string().trim().min(1).max(128);
const workspaceSelectorSchema = {
  ...projectSchema,
  workspaceId: idSchema.optional().describe(
    "Workspace to open. Omit only when the project active workspace should be used.",
  ),
};
const workspaceMutationSchema = {
  ...projectSchema,
  workspaceId: idSchema.describe(
    "Exact workspace to mutate. Read or create it first and always pass this id.",
  ),
};
const anchorSchema = z.object({
  label: z.string().trim().min(1).max(160),
  targetNodeId: idSchema,
  hint: z.string().trim().max(300).optional(),
});
const sourceSchema = z.object({
  label: z.string().trim().min(1).max(300),
  url: z.string().trim().max(4000).optional(),
  path: z.string().trim().max(2000).optional(),
});
const turnSchema = z.object({
  id: idSchema,
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(120000),
  anchors: z.array(anchorSchema).optional(),
  sources: z.array(sourceSchema).optional(),
  createdAt: z.string().optional(),
});
const nodeSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1).max(240),
  shortTitle: z.string().trim().min(1).max(80).optional(),
  lead: z.string().trim().max(1200).optional(),
  year: z.string().trim().max(80).optional(),
  position: z.object({ x: z.number().finite(), y: z.number().finite() }).optional(),
  turns: z.array(turnSchema).min(1),
  createdAt: z.string().optional(),
});
const edgeSchema = z.object({
  from: idSchema,
  to: idSchema,
  kind: z.enum(["fork", "synthesis"]).optional(),
});
const articleSchema = z.object({
  title: z.string().trim().min(1).max(300),
  markdown: z.string().trim().min(1).max(240000),
  citations: z.array(z.object({
    nodeId: idSchema,
    label: z.string().trim().min(1).max(300),
  })).optional(),
});
const storedTurnSchema = turnSchema.extend({
  anchors: z.array(anchorSchema),
  sources: z.array(sourceSchema),
  createdAt: z.string(),
});
const storedNodeSchema = nodeSchema.extend({
  shortTitle: z.string(),
  lead: z.string(),
  year: z.string(),
  position: z.object({ x: z.number(), y: z.number() }).nullable(),
  turns: z.array(storedTurnSchema),
  createdAt: z.string(),
});
const storedEdgeSchema = edgeSchema.extend({
  kind: z.enum(["fork", "synthesis"]),
});
const storedArticleSchema = articleSchema.extend({
  citations: z.array(z.object({
    nodeId: idSchema,
    label: z.string(),
  })),
});
const workspaceSchema = z.object({
  version: z.literal(1),
  revision: z.number().int().nonnegative(),
  rootNodeId: idSchema.nullable(),
  activeNodeId: idSchema.nullable(),
  nodes: z.array(storedNodeSchema),
  edges: z.array(storedEdgeSchema),
  article: storedArticleSchema.nullable(),
  completedRequestIds: z.array(idSchema),
  updatedAt: z.string().nullable(),
});
const uiStateSchema = z.object({
  version: z.literal(1),
  activeNodeId: idSchema.nullable(),
  view: z.enum(["explore", "article"]),
  deckNodeIds: z.array(idSchema),
  updatedAt: z.string().nullable(),
});
const workspaceSummarySchema = z.object({
  id: idSchema,
  title: z.string(),
  origin: z.enum(["conversation", "blank", "legacy"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  legacy: z.boolean().optional(),
});
const workspaceListFields = {
  activeWorkspaceId: idSchema.nullable(),
  workspaces: z.array(workspaceSummarySchema),
};
const storageResultSchema = {
  storage: z.enum(["project", "empty"]),
  projectDir: z.string(),
  latticeDir: z.string(),
  workspaceId: idSchema.nullable(),
  ...workspaceListFields,
  workspace: workspaceSchema,
  uiState: uiStateSchema,
};
const mutationResultSchema = {
  ok: z.literal(true),
  changed: z.boolean(),
  projectDir: z.string(),
  latticeDir: z.string(),
  workspaceId: idSchema,
  workspace: workspaceSchema,
  warning: z.string().optional(),
};

const manifest = JSON.parse(
  readFileSync(pluginPath(".codex-plugin", "plugin.json"), "utf8"),
);
const server = new McpServer(
  { name: manifest.name, version: manifest.version },
  {
    instructions:
      "Lattice stores multiple graph-native research workspaces in <projectDir>/.lattice. Use render_lattice_workspace only to open the native UI. All other tools work without a UI. A request to research the current conversation creates origin=conversation, initializes its first graph from conversation context, then renders it. A directory-only launch creates origin=blank and renders it without placeholder research. Existing data is never overwritten just because a new workspace starts. List workspaces when opening existing research. Read get_lattice_workspace before changing research, then call apply_lattice_research_patch with the same workspaceId. Generate a stable title once for each new node. Never rewrite an existing node or turn; append follow-up turns and add edges. Every anchor must target an existing node or a node added in the same patch. Pass the user's active project as an absolute projectDir.",
  },
);

registerWidgetResource(server, {
  name: "lattice-workspace-widget",
  uri: WIDGET_URI,
  title: "Lattice Research Workspace",
  description:
    "A native fullscreen Lattice workspace for reading stacked research Cards, following anchors, and continuing research with Codex.",
  html: latticeStaticHtml,
});

registerAppTool(
  server,
  TOOL_RENDER,
  {
    title: "Render Lattice Workspace",
    description:
      "Open one native Lattice research workspace for the active project. Create or select the workspace first so separate research graphs are never merged implicitly.",
    inputSchema: {
      ...workspaceSelectorSchema,
      title: z.string().trim().max(240).optional(),
      displayMode: z.enum(["inline", "fullscreen"]).optional(),
    },
    outputSchema: {
      version: z.literal(1),
      widget: z.literal("lattice-workspace-widget"),
      rendering: z.literal("native-widget"),
      title: z.string(),
      projectDir: z.string(),
      latticeDir: z.string(),
      workspaceId: idSchema.nullable(),
      ...workspaceListFields,
      preferredDisplayMode: z.enum(["inline", "fullscreen"]),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    _meta: {
      ui: {
        resourceUri: WIDGET_URI,
        visibility: ["model", "app"],
      },
      "ui/resourceUri": WIDGET_URI,
      "openai/outputTemplate": WIDGET_URI,
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Opening Lattice...",
      "openai/toolInvocation/invoked": "Lattice ready",
    },
  },
  async (input) => {
    const state = await readLatticeState(input);
    const preferredDisplayMode = input.displayMode || DEFAULT_DISPLAY_MODE;
    const selected = state.workspaces.find(
      (workspace) => workspace.id === state.workspaceId,
    );
    const title = input.title?.trim() || selected?.title || "Lattice";
    return {
      content: [{
        type: "text",
        text: state.workspaceId
          ? `Opened Lattice workspace ${state.workspaceId} for ${state.projectDir}.`
          : `Opened an uninitialized Lattice surface for ${state.projectDir}.`,
      }],
      structuredContent: {
        version: 1,
        widget: "lattice-workspace-widget",
        rendering: "native-widget",
        title,
        projectDir: state.projectDir,
        latticeDir: state.latticeDir,
        workspaceId: state.workspaceId,
        activeWorkspaceId: state.activeWorkspaceId,
        workspaces: state.workspaces,
        preferredDisplayMode,
      },
      _meta: {
        "openai/outputTemplate": WIDGET_URI,
        widgetData: {
          title,
          rendering: "native-widget",
          projectDir: state.projectDir,
          latticeDir: state.latticeDir,
          workspaceId: state.workspaceId,
          activeWorkspaceId: state.activeWorkspaceId,
          workspaces: state.workspaces,
          preferredDisplayMode,
        },
      },
    };
  },
);

server.registerTool(
  TOOL_LIST,
  {
    title: "List Lattice Workspaces",
    description:
      "List the independent research workspaces stored in <projectDir>/.lattice and identify the active workspace. Use this before opening existing research.",
    inputSchema: projectSchema,
    outputSchema: {
      projectDir: z.string(),
      latticeDir: z.string(),
      ...workspaceListFields,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    const result = await listLatticeWorkspaces(input);
    return {
      content: [{
        type: "text",
        text: result.workspaces.length === 0
          ? "This project has no Lattice workspaces."
          : `Found ${result.workspaces.length} Lattice workspace${result.workspaces.length === 1 ? "" : "s"}.`,
      }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  TOOL_CREATE,
  {
    title: "Create Lattice Workspace",
    description:
      "Create a separate research workspace in <projectDir>/.lattice. Use conversation when current chat history will seed the first graph; use blank for a directory-only launch with no initial research.",
    inputSchema: {
      ...projectSchema,
      title: z.string().trim().min(1).max(240).optional(),
      origin: z.enum(["conversation", "blank"]),
      workspaceId: idSchema.optional(),
    },
    outputSchema: {
      ok: z.literal(true),
      changed: z.boolean(),
      projectDir: z.string(),
      latticeDir: z.string(),
      workspaceId: idSchema,
      ...workspaceListFields,
      workspace: workspaceSchema,
      uiState: uiStateSchema,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async (input) => {
    const result = await createLatticeWorkspace(input);
    return {
      content: [{
        type: "text",
        text: `Created Lattice workspace ${result.workspaceId}.`,
      }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  TOOL_GET,
  {
    title: "Get Lattice Workspace",
    description:
      "Read durable Lattice graph, conversations, article, and UI state from <projectDir>/.lattice. This tool is usable without the native widget.",
    inputSchema: workspaceSelectorSchema,
    outputSchema: storageResultSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    const state = await readLatticeState(input);
    return {
      content: [{
        type: "text",
        text: `Loaded Lattice revision ${state.workspace.revision} (${state.storage}).`,
      }],
      structuredContent: state,
    };
  },
);

server.registerTool(
  TOOL_APPLY,
  {
    title: "Apply Lattice Research Patch",
    description:
      "Atomically add immutable research nodes, append follow-up turns, add graph edges, set focus, or replace the complete compiled Article. Read current state first and pass expectedRevision to detect concurrent edits.",
    inputSchema: {
      ...workspaceMutationSchema,
      expectedRevision: z.number().int().nonnegative(),
      patch: z.object({
        addNodes: z.array(nodeSchema).optional(),
        appendTurns: z.array(z.object({
          nodeId: idSchema,
          turns: z.array(turnSchema).min(1),
        })).optional(),
        addEdges: z.array(edgeSchema).optional(),
        rootNodeId: idSchema.optional(),
        activeNodeId: idSchema.optional(),
        article: articleSchema.nullable().optional(),
        completeRequestId: idSchema.optional().describe(
          "Widget request id. Set only when this same patch contains the completed assistant answer.",
        ),
      }),
    },
    outputSchema: mutationResultSchema,
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  async (input) => {
    const result = await applyLatticePatch(input);
    return {
      content: [{
        type: "text",
        text: result.changed
          ? `Applied Lattice research patch at revision ${result.workspace.revision}.`
          : `Lattice already contains this patch at revision ${result.workspace.revision}.`,
      }],
      structuredContent: result,
    };
  },
);

server.registerTool(
  TOOL_SAVE_UI,
  {
    title: "Save Lattice UI State",
    description:
      "Persist only Lattice presentation state, including active Card, Explore or Article view, and current Deck lineage. This does not mutate research truth.",
    inputSchema: {
      ...workspaceMutationSchema,
      uiState: z.object({
        activeNodeId: idSchema.nullable().optional(),
        view: z.enum(["explore", "article"]).optional(),
        deckNodeIds: z.array(idSchema).optional(),
      }),
    },
    outputSchema: {
      ok: z.literal(true),
      changed: z.boolean(),
      projectDir: z.string(),
      latticeDir: z.string(),
      workspaceId: idSchema,
      uiState: uiStateSchema,
      warning: z.string().optional(),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async (input) => {
    const result = await saveLatticeUiState(input);
    return {
      content: [{ type: "text", text: "Saved Lattice presentation state." }],
      structuredContent: result,
    };
  },
);

await server.connect(new StdioServerTransport());

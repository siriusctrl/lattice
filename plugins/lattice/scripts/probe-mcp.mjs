import {
  link,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["./scripts/start-mcp.mjs"],
});
const client = new Client({ name: "lattice-probe", version: "0.1.0" });
await client.connect(transport);
const secondTransport = new StdioClientTransport({
  command: "node",
  args: ["./scripts/start-mcp.mjs"],
});
const secondClient = new Client({ name: "lattice-probe-2", version: "0.1.0" });
await secondClient.connect(secondTransport);

const projectDir = await mkdtemp(path.join(tmpdir(), "lattice-plugin-probe-"));
try {
  const tools = await client.listTools();
  const names = tools.tools.map((tool) => tool.name);
  const required = [
    "render_lattice_workspace",
    "list_lattice_workspaces",
    "create_lattice_workspace",
    "get_lattice_workspace",
    "apply_lattice_research_patch",
    "save_lattice_ui_state",
  ];
  for (const name of required) {
    if (!names.includes(name)) throw new Error(`Missing MCP tool ${name}.`);
    const tool = tools.tools.find((candidate) => candidate.name === name);
    if (!tool?.outputSchema) throw new Error(`MCP tool ${name} is missing outputSchema.`);
  }

  const renderTool = tools.tools.find((tool) => tool.name === "render_lattice_workspace");
  const getTool = tools.tools.find((tool) => tool.name === "get_lattice_workspace");
  const applyTool = tools.tools.find((tool) => tool.name === "apply_lattice_research_patch");
  const saveUiTool = tools.tools.find((tool) => tool.name === "save_lattice_ui_state");
  if (renderTool?._meta?.["openai/outputTemplate"] !== "ui://widget/lattice/workspace.html") {
    throw new Error("Render tool is not bound to the Lattice widget.");
  }
  if (getTool?._meta?.["openai/outputTemplate"]) {
    throw new Error("Headless state tools must not be bound to the widget.");
  }
  for (const tool of [applyTool, saveUiTool]) {
    if (!tool?.inputSchema?.required?.includes("workspaceId")) {
      throw new Error(`${tool?.name || "Mutation tool"} must require workspaceId.`);
    }
  }

  const renderResult = await client.callTool({
    name: "render_lattice_workspace",
    arguments: { projectDir },
  });
  if (renderResult.structuredContent?.preferredDisplayMode !== "fullscreen") {
    throw new Error("Lattice render tool did not default to fullscreen.");
  }
  if (renderResult.structuredContent?.projectDir !== projectDir) {
    throw new Error("Lattice render tool did not preserve the real project path.");
  }
  if (renderResult.structuredContent?.workspaceId !== null) {
    throw new Error("A fresh project should render without an implicit workspace.");
  }

  const initialList = await client.callTool({
    name: "list_lattice_workspaces",
    arguments: { projectDir },
  });
  if (initialList.structuredContent?.workspaces?.length !== 0) {
    throw new Error("A fresh project should not contain a Lattice workspace.");
  }

  const workspaceId = "plugin-probe";
  const created = await client.callTool({
    name: "create_lattice_workspace",
    arguments: {
      projectDir,
      workspaceId,
      title: "Plugin architecture",
      origin: "conversation",
    },
  });
  if (
    created.structuredContent?.workspaceId !== workspaceId ||
    created.structuredContent?.workspace?.revision !== 0
  ) {
    throw new Error("Lattice did not create the requested conversation workspace.");
  }

  const empty = await client.callTool({
    name: "get_lattice_workspace",
    arguments: { projectDir, workspaceId },
  });
  if (empty.structuredContent?.workspace?.revision !== 0) {
    throw new Error("Fresh Lattice project should start at revision 0.");
  }

  const missingRevision = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      patch: {},
    },
  });
  if (!missingRevision.isError) {
    throw new Error("Research patches must require expectedRevision.");
  }

  const now = "2026-01-01T00:00:00.000Z";
  const patch = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 0,
      patch: {
        addNodes: [{
          id: "root",
          title: "Plugin architecture",
          shortTitle: "Architecture",
          lead: "A durable first Card.",
          position: { x: 20, y: 40 },
          turns: [
            { id: "root-user-1", role: "user", content: "How does it work?" },
            {
              id: "root-assistant-1",
              role: "assistant",
              content: "The widget and MCP server have separate responsibilities.",
              anchors: [],
              sources: [{ label: "README", path: "README.md" }],
            },
          ],
        }],
        rootNodeId: "root",
        activeNodeId: "root",
        completeRequestId: "widget-probe-root",
      },
    },
  });
  if (patch.structuredContent?.workspace?.revision !== 1) {
    throw new Error("Research patch did not create revision 1.");
  }
  if (
    !patch.structuredContent?.workspace?.completedRequestIds?.includes(
      "widget-probe-root",
    )
  ) {
    throw new Error("Completed widget request id was not persisted.");
  }

  const idempotent = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 1,
      patch: {
        addNodes: [{
          id: "root",
          title: "Plugin architecture",
          shortTitle: "Architecture",
          lead: "A durable first Card.",
          position: { x: 20, y: 40 },
          createdAt: now,
          turns: [
            { id: "root-user-1", role: "user", content: "How does it work?", createdAt: now },
            {
              id: "root-assistant-1",
              role: "assistant",
              content: "The widget and MCP server have separate responsibilities.",
              anchors: [],
              sources: [{ label: "README", path: "README.md" }],
              createdAt: now,
            },
          ],
        }],
      },
    },
  });
  if (idempotent.structuredContent?.changed !== false) {
    throw new Error("Repeating an identical patch should be idempotent.");
  }

  const conflict = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 0,
      patch: {
        appendTurns: [{
          nodeId: "root",
          turns: [{ id: "stale-turn", role: "user", content: "Stale write", createdAt: now }],
        }],
      },
    },
  });
  if (!conflict.isError) {
    throw new Error("A stale expectedRevision should reject the research patch.");
  }

  const immutableNode = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 1,
      patch: {
        addNodes: [{
          id: "root",
          title: "Rewritten title",
          turns: [{ id: "replacement", role: "assistant", content: "Replacement", createdAt: now }],
        }],
      },
    },
  });
  if (!immutableNode.isError) {
    throw new Error("Existing node titles and turns should be immutable.");
  }
  const prematureCompletion = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 1,
      patch: {
        appendTurns: [{
          nodeId: "root",
          turns: [{ id: "user-only", role: "user", content: "Not complete yet" }],
        }],
        completeRequestId: "widget-premature",
      },
    },
  });
  if (!prematureCompletion.isError) {
    throw new Error("A user-only patch must not complete a widget request.");
  }

  const eventsPath = path.join(
    projectDir,
    ".lattice",
    "workspaces",
    workspaceId,
    "events.ndjson",
  );
  const previousEvents = await readFile(eventsPath, "utf8");
  const victimPath = path.join(projectDir, "hardlink-victim.txt");
  await unlink(eventsPath);
  await writeFile(victimPath, "victim stays unchanged\n");
  await link(victimPath, eventsPath);
  const hardlinkResult = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 1,
      patch: {
        appendTurns: [{
          nodeId: "root",
          turns: [{ id: "hardlink-write", role: "user", content: "Must be rejected" }],
        }],
      },
    },
  });
  if (!hardlinkResult.isError) {
    throw new Error("Hard-linked event logs must be rejected.");
  }
  if ((await readFile(victimPath, "utf8")) !== "victim stays unchanged\n") {
    throw new Error("Lattice modified a hard-linked victim file.");
  }
  await unlink(eventsPath);
  await writeFile(eventsPath, previousEvents, { mode: 0o600 });

  const concurrentResults = await Promise.all([
    secondClient.callTool({
      name: "apply_lattice_research_patch",
      arguments: {
        projectDir,
        workspaceId,
        expectedRevision: 1,
        patch: {
          appendTurns: [{
            nodeId: "root",
            turns: [{ id: "parallel-a", role: "user", content: "First concurrent write", createdAt: now }],
          }],
        },
      },
    }),
    client.callTool({
      name: "apply_lattice_research_patch",
      arguments: {
        projectDir,
        workspaceId,
        expectedRevision: 1,
        patch: {
          appendTurns: [{
            nodeId: "root",
            turns: [{ id: "parallel-b", role: "user", content: "Second concurrent write", createdAt: now }],
          }],
        },
      },
    }),
  ]);
  if (concurrentResults.filter((result) => !result.isError).length !== 1) {
    throw new Error("Exactly one cross-process write at the same revision should succeed.");
  }

  const childPatch = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 2,
      patch: {
        addNodes: [{
          id: "child",
          title: "Child node",
          turns: [{ id: "child-answer", role: "assistant", content: "A child Card." }],
        }],
        addEdges: [{ from: "root", to: "child" }],
      },
    },
  });
  if (childPatch.structuredContent?.workspace?.revision !== 3) {
    throw new Error("Child patch did not create revision 3.");
  }
  const cycle = await client.callTool({
    name: "apply_lattice_research_patch",
    arguments: {
      projectDir,
      workspaceId,
      expectedRevision: 3,
      patch: {
        addEdges: [{ from: "child", to: "root" }],
      },
    },
  });
  if (!cycle.isError) {
    throw new Error("A graph cycle must be rejected.");
  }

  const savedUi = await client.callTool({
    name: "save_lattice_ui_state",
    arguments: {
      projectDir,
      workspaceId,
      uiState: {
        activeNodeId: "root",
        view: "explore",
        deckNodeIds: ["root"],
      },
    },
  });
  if (savedUi.structuredContent?.uiState?.activeNodeId !== "root") {
    throw new Error("UI state did not persist.");
  }

  const state = await client.callTool({
    name: "get_lattice_workspace",
    arguments: { projectDir, workspaceId },
  });
  if (state.structuredContent?.workspace?.nodes?.length !== 2) {
    throw new Error("Persisted workspace did not contain the expected nodes.");
  }
  const workspaceText = await readFile(
    path.join(
      projectDir,
      ".lattice",
      "workspaces",
      workspaceId,
      "workspace.json",
    ),
    "utf8",
  );
  if (!workspaceText.includes("Plugin architecture")) {
    throw new Error("Project-local workspace file was not written.");
  }

  const blankWorkspaceId = "plugin-probe-blank";
  await client.callTool({
    name: "create_lattice_workspace",
    arguments: {
      projectDir,
      workspaceId: blankWorkspaceId,
      title: "Blank research",
      origin: "blank",
    },
  });
  const workspaceList = await client.callTool({
    name: "list_lattice_workspaces",
    arguments: { projectDir },
  });
  if (
    workspaceList.structuredContent?.activeWorkspaceId !== blankWorkspaceId ||
    workspaceList.structuredContent?.workspaces?.length !== 2
  ) {
    throw new Error("Workspace catalog did not retain two independent workspaces.");
  }
  const blankState = await client.callTool({
    name: "get_lattice_workspace",
    arguments: { projectDir, workspaceId: blankWorkspaceId },
  });
  if (
    blankState.structuredContent?.workspace?.revision !== 0 ||
    blankState.structuredContent?.workspace?.nodes?.length !== 0
  ) {
    throw new Error("A blank workspace must not inherit another graph or placeholder Card.");
  }
  const selectedRender = await client.callTool({
    name: "render_lattice_workspace",
    arguments: { projectDir, workspaceId },
  });
  if (selectedRender.structuredContent?.workspaceId !== workspaceId) {
    throw new Error("Render tool did not preserve the selected workspace id.");
  }

  const resource = await client.readResource({
    uri: "ui://widget/lattice/workspace.html",
  });
  const content = resource.contents?.[0];
  if (content?.mimeType !== "text/html;profile=mcp-app") {
    throw new Error(`Unexpected widget MIME type: ${content?.mimeType}`);
  }
  const html = content?.text || "";
  if (!html.includes("window.latticeMcp") || !html.includes("Lattice")) {
    throw new Error("Widget resource is missing the app shell or MCP bridge.");
  }
  if (
    !html.includes("escapeAttribute") ||
    !html.includes("replaceAll('\"', \"&quot;\")")
  ) {
    throw new Error("Widget attribute contexts must use quote-safe escaping.");
  }
  if (
    !html.includes("waitForRequest") ||
    !html.includes("completedRequestIds") ||
    !html.includes("pendingRequest") ||
    !html.includes("loadGeneration") ||
    !html.includes("workspaceSelect") ||
    !html.includes("composerDisabled")
  ) {
    throw new Error(
      "Widget must isolate workspace loads and wait for correlated durable completion.",
    );
  }
  if (/<script\b[^>]*\btype="module"/i.test(html)) {
    throw new Error("Widget must use classic inline scripts.");
  }
  const shell = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
  if (/<iframe\b/i.test(shell) || /<script\b[^>]+\bsrc=/i.test(shell)) {
    throw new Error("Widget shell must not contain iframes or external scripts.");
  }

  const rejectedRelativePath = await client.callTool({
    name: "get_lattice_workspace",
    arguments: { projectDir: "." },
  });
  if (!rejectedRelativePath.isError) {
    throw new Error("Relative projectDir should be rejected.");
  }

  console.log("OK: Lattice MCP tools, persistence, and native widget resource are available.");
} finally {
  await secondClient.close();
  await client.close();
  await rm(projectDir, { recursive: true, force: true });
}

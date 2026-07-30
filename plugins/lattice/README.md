# Lattice Codex plugin

This package opens a native Lattice research workspace inside Codex. The widget
is served as an MCP Apps resource over stdio, so normal use does not start a
localhost web server.

Research data is stored in the active project, never in the plugin directory:

```text
<project>/.lattice/
├── workspaces.json
└── workspaces/
    └── <workspace-id>/
        ├── workspace.json
        ├── events.ndjson
        └── ui-state.json
```

The static website at the repository root remains a deterministic demo and
does not import this package.

The plugin currently ships a self-contained functional Widget entry under
`widget/`. It mirrors the Lattice Card, graph, Article, anchor, and composer
surfaces while consuming the project-backed MCP schema. The repository React
workspace can now hydrate that same schema through ACP. The native widget stays
self-contained because Codex supplies its MCP Apps bridge and resource
lifecycle, not because it uses a different research model.

## Publication status

This plugin is not published to a remote or public Codex marketplace. The
Lattice repository ships a repo-local manifest at
`.agents/plugins/marketplace.json`; installation currently points Codex at a
checkout on the same machine.

## Install in Codex

From the root of a Lattice checkout:

```bash
cd /absolute/path/to/lattice
npm --prefix plugins/lattice ci --ignore-scripts
npm --prefix plugins/lattice run quality

codex plugin marketplace add /absolute/path/to/lattice
codex plugin add lattice@personal
codex plugin list
```

If the marketplace was already registered, skip
`codex plugin marketplace add`. The local entry lives at
`/absolute/path/to/lattice/.agents/plugins/marketplace.json`.

## Use

1. Start a new Codex task after installation.
2. Open the target repository you want to research.
3. From a substantive Codex conversation, ask `Turn this conversation into a
   Lattice research workspace.` Codex creates an independent
   `origin=conversation` workspace and initializes its first graph from the
   current conversation before opening it.
4. From a repository with no prior topic, ask `Open a blank Lattice workspace
   for this project.` Codex creates an independent `origin=blank` workspace and
   opens an empty chat surface. It does not invent a placeholder Card.
5. To resume earlier work, ask Codex to list the project's Lattice workspaces
   and open the one you name.
6. Continue the remaining interaction in the native Lattice workspace.

Starting another research topic in the same repository creates another
workspace under `.lattice/workspaces/`; it never replaces an existing graph.
The widget's selector can switch among them. The original flat
`.lattice/workspace.json` layout is exposed as a legacy workspace in place.
A local `codex://plugins/...marketplacePath=` link can open this plugin's detail
or share flow inside Codex, but it does not mean the plugin has been uploaded.

## Development

```bash
npm ci --ignore-scripts
npm run quality
```

The MCP entry point is `scripts/start-mcp.mjs`. Only
`render_lattice_workspace` is associated with the native UI resource.
Workspace list, create, read, patch, and UI-state tools also work in MCP clients
that do not render MCP Apps. The MCP process never installs packages at
startup; distribution or development setup must install the locked dependencies
ahead of time.

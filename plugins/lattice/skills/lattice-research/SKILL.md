---
name: lattice-research
description: Open and continue a graph-native Lattice research workspace inside Codex. Use when the user asks to open or launch Lattice, research the active repository in Lattice, continue a Lattice Card, create a research branch, or compile the current Lattice research into an Article.
---

# Lattice Research

## Choose the launch mode

Every Lattice graph belongs to one workspace inside the active project's
`.lattice` directory. More than one workspace may live in the same project.
Always use the user's active Codex workspace as an absolute `projectDir`. Never
pass the plugin directory.

Choose one of these modes from the request and the current conversation:

### Start from this conversation

Use this mode when the user asks to research the current topic, turn the current
discussion into research, or otherwise refers to substantive context already in
the Codex conversation.

1. Generate a concise title once from the topic.
2. Call `create_lattice_workspace` with `origin: "conversation"`.
3. Call `get_lattice_workspace` with the returned `workspaceId`.
4. Use the current conversation history to create the first complete root Card
   and any clearly supported prepared branches. Persist them with
   `apply_lattice_research_patch` at revision `0`.
5. Call `render_lattice_workspace` with that exact `workspaceId`.

Conversation history is source context, not permission to invent citations.
Preserve important decisions and open questions in the initial graph. Keep
titles concise and generate each title only once.

```json
{
  "projectDir": "/absolute/path/to/the/active/project",
  "title": "Research topic",
  "origin": "conversation"
}
```

### Start blank in this folder

Use this mode when the user asks to start or open Lattice in a folder and the
conversation contains no substantive research topic.

1. Call `create_lattice_workspace` with `origin: "blank"` and a concise neutral
   workspace title.
2. Immediately call `render_lattice_workspace` with the returned `workspaceId`.
3. Do not add a placeholder Card, demo graph, sample question, or Article.

The empty widget is the starting chat surface. Its first question becomes the
root research Card through the normal widget request flow.

### Open existing research

Only reuse an existing workspace when the user explicitly asks to open or
continue one. First call `list_lattice_workspaces`, then render the requested
workspace or the catalog's active workspace. If the user asks to start new
research, create a new workspace even when `.lattice` already exists. Never
overwrite or silently merge another workspace.

## Render a workspace

Pass the selected workspace ID when rendering:

```json
{
  "projectDir": "/absolute/path/to/the/active/project",
  "workspaceId": "workspace-id-returned-by-create-or-list",
  "displayMode": "fullscreen"
}
```

The tool returns `openai/outputTemplate:
ui://widget/lattice/workspace.html`, which tells Codex to render the native
widget. Do not start a localhost service.

## Continue research

When a prompt originates in the Lattice widget:

1. Read `Request.projectDir` and `Request.workspaceId` from the widget prompt.
2. Call `get_lattice_workspace` with both values before researching.
3. Use the active project and relevant Card turns as context.
4. Perform the requested repository or web research with normal Codex tools.
5. Call `apply_lattice_research_patch` with the same `workspaceId` when the
   answer is complete. Do not only
   answer in the Codex transcript.
6. Pass `expectedRevision` from the prior read.
7. If the widget prompt includes `Request.requestId`, set
   `patch.completeRequestId` to that exact value only in the patch containing
   the completed assistant answer. Never complete it in a user-only,
   focus-only, or Article-only patch.

For a question asked in an existing Card, append one user turn and one assistant
turn to that node. A follow-up stays inside the active node.

For an explicit fork or a selection-sourced question, add a new node and its
edge. Generate `title` and `shortTitle` once at creation. Existing nodes and
turns are immutable.

Assistant turns may contain anchors. Every anchor must point to an existing
node or a node added in the same patch:

```json
{
  "label": "Capability negotiation",
  "targetNodeId": "capability-negotiation",
  "hint": "Open the prepared research Card"
}
```

Add sources as URLs or project-relative file paths. Do not expose credentials
or write harness process state into `.lattice`.

## Article

When the user asks for an Article, set `patch.article` to the complete current
edition, not a draft or incremental fragment. Article citations point back to
Cards by `nodeId`.

## Storage and compatibility

Research is stored in workspace-specific files under `<projectDir>/.lattice`.
Always pass `workspaceId` to read, patch, render, and UI-state calls so activity
cannot leak between graphs. The list, create, read, and patch tools remain
usable in MCP clients that do not render the widget.

If the plugin was just installed or upgraded and its tools are absent, start a
new Codex conversation so the MCP schema is loaded again.

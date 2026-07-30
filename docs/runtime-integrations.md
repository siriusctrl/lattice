# Runtime integrations

Lattice now has three deliberately separate runtime shapes. They share the
interaction contract, but they do not share deployment or process authority.

| Surface | Entry | Agent owner | State | Default deployment |
| --- | --- | --- | --- | --- |
| Static showcase | `app/page.tsx` | `DemoHost` | browser memory | enabled |
| Codex plugin | `plugins/lattice/` | Codex through MCP tools | `<project>/.lattice/` | not bundled |
| ACP workspace | `AcpHost` plus `integrations/acp/` | Codex or Claude adapter | `<project>/.lattice/` | dormant unless locally configured |

## Shared browser contract

`app/lib/lattice-host.ts` is the browser-safe boundary. A host starts either a
follow-up or selected-text fork and returns an async event stream plus
cancellation. The stream can report status, text deltas, anchors, a complete
result, completion, cancellation, or a recoverable error.

`ResearchWorkspace` owns navigation and rendering. It does not launch a
process, read credentials, or know whether the answer came from the
deterministic demo or ACP. Navigation invalidates obsolete runs so a slow result
cannot write into a Deck that the user has already left.

The published site does not receive an ACP configuration, so `LatticeApp`
chooses `DemoHost`. A trusted local shell may set
`window.__LATTICE_ACP_CONFIG__` before hydration, or open the site with an
`#acp=<base64url-json>` fragment. `--lattice-url` creates that URL. The
fragment is decoded into session storage and removed from the address bar. The
JSON shape is:

```json
{
  "baseUrl": "http://127.0.0.1:43119",
  "token": "sidecar-bearer-token",
  "cwd": "/absolute/path/to/repository",
  "workspaceId": "workspace-..."
}
```

The sidecar must use an exact allowed origin matching the page. Passing
`--lattice-url` derives it automatically; `--allow-origin` can set it
explicitly.
The bearer token grants access to the local harness session. Use this only with
a trusted Lattice build and a loopback sidecar.

## Codex plugin

`plugins/lattice/` is a standalone Codex plugin package modeled after the
native MCP Apps shape used by Cowart. It serves
`ui://widget/lattice/workspace.html` over stdio and asks the host for
fullscreen display. There is no localhost UI server and no iframe to the
deployed showcase.

Only `render_lattice_workspace` is bound to the widget. Headless tools read,
compare-and-swap, and update the project-local store:

```text
<project>/.lattice/
├── workspaces.json
└── workspaces/
    └── <workspace-id>/
        ├── workspace.json
        ├── events.ndjson
        └── ui-state.json
```

The catalog lets one project contain multiple independent knowledge graphs.
Starting research from an existing Codex conversation creates a
`conversation` workspace and initializes its first graph from task history.
Opening Lattice from a directory without a prior topic creates a `blank`
workspace and renders an empty chat surface. Neither path overwrites an existing
workspace. The original flat layout remains readable as an in-place legacy
workspace.

Titles and completed turns are immutable. Mutations target one workspace id,
use a revision check plus a cross-process project lock, reject links, validate
stored schema and size, and reject graph cycles. The widget escapes persisted
values separately for text and attribute contexts.

When a user asks from the widget, `sendMessage` only hands the request to
Codex. The widget therefore keeps the draft disabled and polls durable state
until that exact request id appears in `completedRequestIds` on a newer
revision. An acknowledgement or an unrelated project mutation is never treated
as a completed Card.

The plugin is not published to a remote or public marketplace. The repository
ships only a local marketplace manifest at
`.agents/plugins/marketplace.json`. Install and verify the plugin dependencies
before registering this checkout on the current machine:

```bash
cd /absolute/path/to/lattice
npm --prefix plugins/lattice ci --ignore-scripts
npm --prefix plugins/lattice run quality

codex plugin marketplace add /absolute/path/to/lattice
codex plugin add lattice@personal
codex plugin list
```

Start a new Codex task after installation so the new skill and MCP server are
loaded. Open the target research repository. Ask Codex to turn the current
conversation into a Lattice workspace, to open a blank workspace, or to list
and reopen an existing workspace. The MCP startup script never installs
dependencies. Local `codex://plugins` links refer to this checkout and do not
imply publication.

## ACP sidecar

`integrations/acp/` is a zero-runtime-dependency ACP v1 client and authenticated
loopback HTTP/SSE sidecar. It owns child-process lifecycle, permission policy,
timeouts, and streamed ACP events. Browser code receives no direct process or
filesystem capability.

Build and start Codex:

```bash
cd integrations/acp
npm ci
npm test
codex login status
node dist/cli.js \
  --preset codex \
  --cwd /absolute/path/to/repository \
  --lattice-url http://localhost:3000/
```

Use `--preset claude` for Claude Code after `claude auth status` confirms the
local harness is authenticated. The CLI prints `workspaceUrl` together
with the generated base URL and bearer token. Open `workspaceUrl` to keep the
remaining interaction in Lattice. `AcpHost` creates an ACP session, subscribes
to SSE, maps agent message chunks and tool activity into `LatticeHost` events,
and sends ACP cancellation when the user navigates away.

Omitting `--workspace-id` creates a new blank workspace. Supply
`--workspace-id <id>` to resume one returned by the workspace list endpoint.

The sidecar binds one canonical project directory at startup. Its authenticated
storage endpoints do not accept a client-selected path; they reuse the exact
storage module used by the Codex plugin. On open, `AcpHost` hydrates Cards,
turns, anchors, edges, active view, and Deck position for the selected
workspace. A new blank workspace contains no mock or placeholder Card. Its
first question asks the harness to generate and persist the durable root title
and answer. Completed follow-ups and selected-text forks are compare-and-swap
mutations, so the browser never reports completion before that workspace's
`workspace.json` commits.

Client-supplied MCP server definitions are rejected by default because a stdio
definition can execute a local command. They require an explicit trusted
sidecar opt-in. Agent tool permissions are rejected by default or can be
resolved through the manual permission API.

## Why both MCP Apps and ACP

ACP and MCP Apps solve different seams:

- ACP adapts a harness process. It gives a standalone Lattice client one
  lifecycle for Codex and Claude Code.
- MCP Apps gives Codex a native interactive surface and model-callable tools.
- `LatticeHost` keeps browser rendering independent of both mechanisms.

The result is not a generic `AgentAdapter` layer on top of ACP. ACP remains the
harness adapter. Lattice owns only its product protocol: questions, selected
forks, streamed answers, graph results, cancellation, and durable rendering.

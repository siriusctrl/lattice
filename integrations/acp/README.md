# Lattice ACP sidecar

This directory contains a zero-runtime-dependency Agent Client Protocol v1
client and a loopback HTTP/SSE sidecar for Lattice. It launches an ACP agent as
a child process, while browser code talks only to the sidecar.

It is independent from the existing static demo and vinext deployment. Nothing
in this package is bundled into the static build, and the browser never
launches Codex, Claude, or another local process.

The sidecar and Codex plugin reuse one storage implementation. Completed
research and reading position live under the selected repository:

```text
<project>/.lattice/
├── workspaces.json
└── workspaces/
    └── <workspace-id>/
        ├── workspace.json
        ├── events.ndjson
        └── ui-state.json
```

Each sidecar run selects one workspace. Without `--workspace-id`, it creates a
new blank workspace and the browser opens with no generated placeholder
content. Pass an existing id to resume that graph:

```bash
node dist/cli.js \
  --preset codex \
  --cwd /absolute/path/to/repository \
  --workspace-id <workspace-id> \
  --lattice-url http://localhost:3000/
```

## Supported lifecycle

- `initialize` with ACP protocol version 1
- `session/new`
- `session/prompt`
- streaming `session/update` notifications
- `session/request_permission`
- `session/cancel`
- graceful transport shutdown

ACP v1 does not define a `shutdown` JSON-RPC method. Shutdown therefore follows
the official stdio transport lifecycle: close the agent's stdin, wait for it to
exit, send `SIGTERM` after the grace period, then use `SIGKILL` only if it still
does not exit.

The implementation follows the current
[ACP v1 initialization](https://agentclientprotocol.com/protocol/initialization),
[prompt lifecycle](https://agentclientprotocol.com/protocol/prompt-turn), and
[stdio transport](https://agentclientprotocol.com/protocol/transports)
documentation.

## Run

From this directory:

```bash
npm ci
npm run build
codex login status
node dist/cli.js --preset codex --cwd /absolute/path/to/repository
```

To open the local Lattice UI with ACP enabled, pass its trusted page URL:

```bash
node dist/cli.js \
  --preset codex \
  --cwd /absolute/path/to/repository \
  --lattice-url http://localhost:3000/
```

The ready record then includes `workspaceUrl`. Its `#acp=` fragment contains
the loopback URL, bearer token, and project path as base64url JSON. URL
fragments are not sent in the page request. Lattice moves the configuration
into session storage and removes the fragment from the address bar during
hydration. `--lattice-url` also sets the exact CORS origin unless
`--allow-origin` was supplied explicitly.

Or run the ACP registry's Claude Agent adapter, which uses the Claude Agent SDK:

```bash
claude auth status
node dist/cli.js --preset claude --cwd /absolute/path/to/repository
```

The presets launch these packages with `npx`:

- `@agentclientprotocol/codex-acp`
- `@agentclientprotocol/claude-agent-acp`

For reproducible installs, install a pinned adapter yourself and pass its
executable directly:

```bash
node dist/cli.js \
  --agent-command /absolute/path/to/codex-acp \
  --cwd /absolute/path/to/repository
```

Arguments are passed without a shell:

```bash
node dist/cli.js \
  --agent-command npx \
  --agent-arg -y \
  --agent-arg @agentclientprotocol/codex-acp@1.1.7 \
  --cwd /absolute/path/to/repository
```

Every RPC has a finite timeout. Non-prompt calls default to 30 seconds and
prompts default to 30 minutes:

```bash
node dist/cli.js \
  --preset codex \
  --request-timeout-ms 30000 \
  --prompt-timeout-ms 1800000
```

The first stdout line is machine-readable connection information:

```json
{
  "event": "ready",
  "baseUrl": "http://127.0.0.1:43119",
  "token": "generated-bearer-token",
  "projectDir": "/absolute/path/to/repository",
  "agentPid": 12345,
  "agent": {
    "protocolVersion": 1
  },
  "workspaceUrl": "http://localhost:3000/#acp=..."
}
```

Agent logs are captured from stderr and forwarded as SSE events. The agent must
keep stdout reserved for newline-delimited ACP JSON-RPC messages.

### Environment

CLI options also have `LATTICE_ACP_` environment equivalents:

```bash
export LATTICE_ACP_AGENT_COMMAND=/absolute/path/to/claude-agent-acp
export LATTICE_ACP_AGENT_ARGS='[]'
export LATTICE_ACP_CWD=/absolute/path/to/repository
export LATTICE_ACP_PERMISSION_MODE=reject
node dist/cli.js
```

The child inherits the sidecar environment, so existing Codex or Claude
credentials remain under their normal harness configuration. The sidecar does
not accept, persist, or add credentials of its own.

## HTTP API

All endpoints require:

```text
Authorization: Bearer <token>
```

The server binds to `127.0.0.1` and chooses a free port by default. Supply an
exact `--allow-origin` only when a browser origin needs CORS access.

### Status

```http
GET /v1/status
```

### Durable Lattice state

These endpoints are used by `AcpHost`. They are authenticated like the session
API and always operate on the canonical `--cwd` selected when the sidecar
started. A browser cannot supply a different project path.

```http
POST /v1/lattice/workspaces
POST /v1/lattice/workspaces/create
POST /v1/lattice/state
POST /v1/lattice/patch
POST /v1/lattice/ui-state
```

`workspaces` lists every graph in the canonical project. `workspaces/create`
creates an independent `blank` or `conversation` workspace. The remaining
requests include `workspaceId`; `state` hydrates that workspace and UI state.
`patch` accepts `expectedRevision` plus the same immutable node and append-only
turn patch used by the Codex plugin. It returns `409 revision_conflict` when
another process commits first. `ui-state` persists only the active Card, view,
and Deck lineage.

### Create a session

```http
POST /v1/sessions
Content-Type: application/json

{
  "cwd": "/absolute/path/to/repository",
  "additionalDirectories": []
}
```

Client-provided `mcpServers` are rejected by default because they can launch
local processes or forward credentials. A trusted local host must explicitly
opt in with `--allow-client-mcp-servers` or
`LATTICE_ACP_ALLOW_CLIENT_MCP_SERVERS=true`. Definitions are schema-checked
before being forwarded:

```bash
node dist/cli.js --preset codex --allow-client-mcp-servers
```

### Start a prompt

The HTTP request returns immediately with a Lattice `turnId`. Updates and
completion arrive over SSE.

```http
POST /v1/sessions/:sessionId/prompts
Content-Type: application/json

{ "text": "Research this repository" }
```

An ACP `ContentBlock[]` can be sent as `prompt` instead of `text`.

### Stream events

```http
GET /v1/events
Accept: text/event-stream
```

Optional query parameters:

- `after=<sequence>` replays buffered events after a sequence number.
- `sessionId=<id>` filters session-scoped events.

`Last-Event-ID` is also supported. The sidecar retains the latest 500 events by
default. Each subscriber has a bounded 256 KiB pending-write queue. A
backpressured subscriber that exceeds it is disconnected and can reconnect with
`Last-Event-ID`; it cannot grow sidecar memory without bound. Configure the cap
with `--sse-client-queue-bytes`.

Stable event names are:

- `sidecar.ready`
- `session.created`
- `turn.started`
- `session.update`
- `permission.requested`
- `permission.resolved`
- `turn.cancel_requested`
- `turn.completed`
- `turn.failed`
- `agent.stderr`
- `agent.protocol_error`
- `agent.exit`
- `sidecar.stopping`

Every SSE data object includes `sequence`, `timestamp`, `type`, optional
`sessionId` and `turnId`, and `data`.

### Permissions

The default `reject` policy chooses `reject_once`, then `reject_always`, and
falls back to the ACP `cancelled` outcome if the agent offers no rejection
option. It never silently grants a tool request.

With `--permission-mode manual`, the sidecar emits `permission.requested` and
waits for:

```http
POST /v1/permissions/:permissionId/resolve
Content-Type: application/json

{ "optionId": "allow-once" }
```

Only an option offered by the agent is accepted. A timeout safely rejects the
request. Cancelling a turn resolves every pending permission for that session
with ACP's required `cancelled` outcome.

### Cancel and shutdown

```http
POST /v1/sessions/:sessionId/cancel
POST /v1/shutdown
```

## Programmatic use

The build emits JavaScript and declarations in `dist/`:

```ts
import { AcpClient, AcpSidecar } from "./dist/index.js";
```

`AcpClient` is useful for another trusted Node host. `AcpSidecar` is the
recommended boundary for a standalone Lattice frontend.

## Verification

```bash
npm test
npm run probe
```

Tests use a real child process implementing a small fake ACP agent. They cover
initialization, session creation, streamed updates, safe rejection, manual
permission resolution, cancellation, authenticated HTTP/SSE, bounded
backpressure, missing executables, stdin `EPIPE`, malformed responses, RPC
timeouts, client MCP trust boundaries, project-local persistence, revision
conflicts, and shutdown.
The probe launches the compiled CLI and exercises the public API end to end.

## Deliberate limits

- Only ACP v1 is negotiated.
- File-system and terminal client capabilities are not advertised. Agents
  operate through their own harness and configured MCP servers.
- Authentication methods advertised through ACP are reported but not
  performed. Codex and Claude adapters are expected to use their existing local
  authentication.
- One prompt may be active per session. Multiple independent sessions are
  supported by the agent when its implementation allows them.

# Architecture

## Product model

Lattice presents a simple browsing experience over four separate internal
structures:

```text
Focus stack
    |
Append-only user actions
    |
Exploration DAG
    |
Context compiler
```

Only the focus stack and graph projection exist in this frontend prototype.
Model-driven context compilation and durable event storage remain intentionally
outside the mock.

## Current frontend state

`ResearchWorkspace` owns:

- the active card stack
- forward navigation history
- discovered node ids
- graph edges created by actual exploration
- local follow-up turns
- user-selected custom nodes
- theme and graph window state

The static fixture defines every prepared biography node, its anchor targets,
and its graph coordinates. The interface only reveals nodes that the user has
discovered, plus faint potential children of the active node.

When the user reaches the 2008 crisis from both SpaceX and Tesla, Lattice adds a
second incoming edge to the existing crisis node. The content is reused, so the
research structure becomes a DAG rather than two duplicated trees.

## Card model

A card is a focused research unit, not a single message. It can contain:

- one source prompt
- a prepared or streamed answer
- multiple semantic anchors
- local follow-up turns
- source media
- an automatically derived digest in a future version

The active card owns pointer input. Earlier cards remain visible as inert layers
to preserve spatial memory.

## Model and harness connection

The recommended production boundary is a typed event adapter:

```ts
type AgentEvent =
  | { type: "text_delta"; text: string }
  | { type: "anchor"; label: string; targetHint: string }
  | { type: "artifact"; path: string; mediaType: string }
  | { type: "status"; state: "thinking" | "running_tool" | "done" }
  | { type: "error"; message: string };

interface AgentAdapter {
  start(input: {
    prompt: string;
    contextNodeIds: string[];
    files: string[];
  }): AsyncIterable<AgentEvent>;
  cancel(runId: string): Promise<void>;
}
```

The browser can consume that stream through SSE or WebSocket. A Cloudflare
Worker can call hosted model APIs. A local sidecar can expose the same protocol
while launching Codex or Claude Code with workspace permissions.

The browser must not receive provider keys or unrestricted filesystem access.
Those capabilities belong to the gateway or sidecar.

## Why TypeScript

TypeScript gives one shared schema for:

- browser actions
- graph events
- streamed agent events
- stored Markdown metadata
- adapter capability negotiation

React is appropriate because card focus, selection, local follow-ups, and graph
projection are stateful product interactions. Motion is isolated to visual
state changes. It is not used as the state engine.

## Future boundaries

The next technical layer should add:

1. an append-only event store
2. a model adapter with streamed events
3. a context compiler service
4. Markdown materialization
5. file snapshot identities
6. read-only and writable harness capability policies

These additions should not require changing the card interaction contract.

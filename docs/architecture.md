# Architecture

## Product model

Lattice presents two user views over three separate internal representations:

```text
Append-only user actions
       |
       +--> Card conversations
       |
       +--> Exploration DAG
       |
       +--> Flat Article projection
```

The Card stack, exploration graph, and deterministic Article projection exist
in this frontend prototype. Model-driven compilation and durable event storage
remain intentionally outside the mock.

## Current frontend state

`ResearchWorkspace` owns:

- the active card stack
- visible node ids, initialized with the complete prepared artifact
- the complete prepared graph plus user-created edges
- local follow-up turns
- user-selected custom nodes
- Explore and Article view state
- the current Article focus section
- theme and graph window state

The static fixture defines every prepared biography node, its anchor targets,
relations, and fallback ordering hints. The showcase reveals the entire
prepared graph immediately. `GraphPreview` computes one layered layout from
that completed DAG and keeps the geometry stable while the user changes Card
focus. A spring-driven marker and connected-edge emphasis communicate movement
without making the graph jump. Only an explicit user-created selection node
changes the visible graph and triggers a new layout.

The 2008 crisis already has incoming paths from both SpaceX and Tesla. Opening
either branch focuses the same crisis Card, so the structure reads as a DAG
rather than two duplicated trees.

## Card model

A card is a focused research unit, not a single message. It can contain:

- one source prompt
- a prepared or streamed answer
- multiple semantic anchors
- local follow-up turns

The entire Card should remain normal chat. It does not render answer titles,
metadata headers, labeled digests, temporary conclusions, reading-guide
callouts, or Article shortcuts. Those editorial structures belong in the
Article compiler, not in the source Card.

The active card owns pointer input. Earlier cards remain visible as inert layers
to preserve spatial memory. Closing the active card pops only the focus stack;
the complete graph remains unchanged.

## Article model

Article is a flat, continuously readable document. It is not one Markdown file
per Card, and its section hierarchy does not mirror the exploration DAG.

`article-research.ts` currently acts as a deterministic compiler. It reads:

- the complete prepared Card set
- prepared and user-created graph edges
- nodes that contain local follow-up turns

It returns ordered article sections with prose, synthesis status, and source
Card ids. The prepared biography opens as a complete multi-path synthesis.
Local follow-ups and user-created nodes can still add research notes without
asking the user to merge anything.

Every article section keeps provenance. Opening a source returns to the original
Card and restores its exploration context.

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

## Deployment surfaces

The default vinext build remains Cloudflare Worker compatible for Sites.
`GITHUB_PAGES=true` switches vinext to static export, while Vite prefixes
browser assets with `/lattice/`. The resulting `dist/client` artifact contains
the same client-side interactions and is published by GitHub Actions.

## Future boundaries

The next technical layer should add:

1. an append-only event store
2. a model adapter with streamed events
3. a context compiler service
4. flat Markdown or article materialization
5. file snapshot identities
6. read-only and writable harness capability policies

These additions should not require changing the card interaction contract.

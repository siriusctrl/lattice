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
- the active index and Deck Spread gesture state
- visible node ids, initialized with the complete prepared artifact
- the complete prepared graph plus user-created edges
- local follow-up turns
- user-selected custom nodes
- Explore and Article view state
- the two-phase Deck suffix transition
- the current Article focus section
- theme and graph window state

The workspace component remains the state boundary, while presentational and
pure logic are kept outside it. `WorkspaceTopbar` renders navigation only.
`research-workspace.ts` owns path lookup, mock follow-up answers, unique-edge
insertion, and selection-node construction. `graph-layout.ts` owns graph depth,
transitive reduction, curved routes, and hover-label placement.

The static fixture defines every prepared biography node, its anchor targets,
relations, and semantic map position. The showcase reveals the entire prepared
node map immediately. `GraphPreview` keeps those positions stable, projects the
relation set into its transitive-reduced primary paths, and reveals redundant
relations only when their node is active. A spring-driven marker and
contextual-edge emphasis communicate movement without making the graph jump.
Only an explicit user-created selection node changes the visible graph.

A node title is fork-time metadata: a model may generate it once from the
anchor, selected text, or user question, and the product persists it with the
node. The graph does not generate a second layer of region names or taxonomy.
Expanded mode is only a larger interactive projection of the same graph.

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

The current ordered root-to-leaf lineage is a Deck, with an independent active
index. In its default stacked state, the active card owns content input while
earlier and later cards remain inert layers. Closing a Card removes the current
Card and every later Card from the Deck suffix, then moves focus to the previous
Card. This changes only the active lineage: every removed Deck node and relation
remains available in the complete research graph.

Suffix replacement is deliberately two phase. First, `ResearchWorkspace`
reveals the retained Card and marks the outgoing suffix as non-interactive.
`ResearchCard` lets the primary outgoing sheet settle slightly down and back
into the Deck, then lowers it behind the retained Card while both surfaces stay
opaque. Later suffix sheets stop painting and disappear immediately behind that
single gesture, avoiding translucent text overlap, visual noise, and unnecessary
compositing work. Only after the motion settles does the workspace commit the
shorter or replacement lineage. The retained Card keeps the same DOM identity
throughout, so its content cannot flash, remount, or reset.
`useDeckTransition` owns the shared exit state, timer cleanup, and final commit.

Deck Spread turns that same lineage into a temporary desktop navigation
surface. The collapsed Deck has no count badge or visible mode control.
Approaching an exposed edge opens only that side around its matching lower
corner: earlier Cards share a fixed lower-left pivot, while later Cards share a
fixed lower-right pivot. The outer layer handles Stack and Spread movement while
two nested fan layers keep those pivots stable through hover, retraction, and
the transition into Spread. Clicking an edge spreads the Cards across the
available horizontal space with adaptive overlap.
A sustained hover promotes one Card into preview while earlier Cards collect
on its left and later Cards collect on its right. Preview selection follows
actual pointer movement, so Cards passing under a stationary cursor during
that reflow cannot chain-trigger a new preview. The persisted fork-time title
appears outside the chat only during inspection. Choosing the Card collapses
the Deck around that historical focus.

Compact preview uses a staged paper handoff. The centered Card owns the highest
stacking layer and follows the finger while the adjacent target rises beneath
it. On release, the outgoing Card follows one monotonic transform directly to
its final opposite-side peek. The scaled Card widths determine an edge-to-edge
resting position, so the preview index and stacking order can change after the
readable surfaces stop overlapping without moving either Card again. Only the
incoming and outgoing sheets animate; background sheets remain still and
full-surface filters are disabled to reduce mobile compositing work.

The desktop Deck reserves a block-axis safety band around its centered Card.
This is part of the fan geometry, not a clipping workaround: outer sheets may
rotate far enough to double their exposed edge, but their raised top edges must
stay below the fixed topbar and their lower corners must remain visible.

Compact screens keep full-size reading and Deck browsing physically distinct.
The reading Card uses native vertical scrolling; exposed Stack sheets are the
only entry points into a folded preview. In that preview, pointer capture and
horizontal motion move an independent preview index one Card at a time while
the active research context stays unchanged. Earlier Cards remain on the left
and later Cards on the right. Swiping centers one preview at a time; tapping
the centered Card commits it and returns to full reading. Escape or switching
workspace views cancels the preview without changing the active Card.

If the user only reads, every later card remains available. If they open an
anchor or create a selection fork from the historical card, the current Deck
keeps its shared prefix and grows a new suffix. Nodes from the previous suffix
remain in the complete DAG.

## Article model

Article is a flat, continuously readable document. It is not one Markdown file
per Card, and its section hierarchy does not mirror the exploration DAG.

`article-research.ts` currently acts as a deterministic compiler. It reads:

- the complete prepared Card set
- prepared and user-created graph edges
- nodes that contain local follow-up turns

It returns ordered article sections with finished prose and source Card ids.
Every compilation is a complete current edition, even when the available
research set is small. The interface never exposes internal labels such as
draft, incomplete, waiting, or developing. New Cards, local follow-ups, and
user-created nodes trigger a richer edition without asking the user to merge
anything.

`ArticleView` owns section focus only. The outline, article paper, and source
rail are separate presentational components under `components/article/`.
Article hierarchy is editorial and chronological rather than a visual copy of
the DAG.

Every article section keeps provenance. Opening a source returns to the original
Card and restores its exploration context.

Explore and Article are persistent sibling layers rather than mutually
exclusive component trees. Their opacity handoff keeps both surfaces mounted,
preserving Card scroll positions, unsent composer text, graph identity, and
Article reading position. Inactive layers are inert and ignored by assistive
technology.

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

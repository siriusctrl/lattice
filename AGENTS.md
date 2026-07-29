# AGENTS.md

## Purpose

Lattice is a focused frontend prototype for stacked-card AI research. Preserve
the core experience: users explore and navigate, while the product manages graph
and context semantics behind the scenes.

## Reading order

1. `README.md`
2. `docs/INDEX.md`
3. `docs/architecture.md`
4. `docs/source-map.md`
5. `app/lib/mock-research.ts`
6. `app/components/ResearchWorkspace.tsx`
7. `app/components/ResearchCard.tsx`
8. `app/components/GraphPreview.tsx`
9. `docs/verification.md`

## Product invariants

- The showcase starts with every prepared research node visible. The graph
  projects all relations into a transitive-reduced set of primary paths, then
  reveals redundant relations only when their node is active.
- Clicking an anchor focuses an existing prepared node without changing graph
  geometry or duplicating content.
- Closing the active Card changes focus but never deletes the persisted graph.
- A Deck is the current ordered root-to-leaf lineage. Its focus may sit on any
  Card, and Card selection inside a spread does not delete later Cards.
- Deck Spread is a desktop navigation mode, not a second content view. Hovering
  the exposed Card edge gives a small fan hint; clicking opens the lineage.
- A sustained hover previews one Card in the center. Earlier Cards collect on
  its left and later Cards collect on its right.
- Compact screens do not have a separate spread mode or visible Deck control.
  Horizontal swipes directly change focus, with earlier and later Cards peeking
  from opposite sides.
- Starting a new fork from a historical Card replaces only the current
  lineage suffix. The complete DAG and the abandoned suffix remain persisted.
- Follow-up questions stay inside the active node.
- User text selection creates a new sourced node.
- The graph is visible but secondary to reading.
- Prepared graph geometry stays fixed while Card focus changes. Only explicit
  user-created nodes may trigger a reflow.
- Prepared node positions are semantic layout hints, not an automatic
  topological layout. Keep the early web, space, mobility, platform, and
  synthesis strands visually distinct.
- Expanded graph mode is semantic zoom over the same graph. Do not add region
  labels, generated taxonomies, summaries, or a second information structure.
- Node titles are generated once when a fork is created, then persisted as node
  metadata. They appear only on pointer hover or keyboard focus, in a label
  layer above every edge.
- Hovering a node emphasizes its connected paths and quiets unrelated edges.
  Do not reintroduce a mixed set of permanently labeled nodes.
- The active graph marker moves between fixed nodes with a smooth transition.
- Explore preserves the original conversation and spatial card history.
- Article is one flat document, never a visual copy of the research DAG.
- Article sections can cite multiple Cards, and each citation can reopen its Card.
- Users never perform a manual merge operation.
- Past answer content is not rewritten when graph context changes.
- Cards should read like normal chat from top to bottom. Do not add answer
  titles, metadata headers, Article shortcuts, labeled conclusions, digests, or
  reading-guide callouts.

## Visual invariants

- Design read: premium knowledge tool with tactile stacked-card materiality.
- Design dials: variance 7, motion 8, density 5.
- Use one cold-neutral palette and one yellow-green accent.
- Cards use a 22px radius; controls use 8px to 11px radii.
- Support light and dark mode at the page level.
- Motion must communicate fork, focus, depth, or feedback.
- Mobile Deck movement must follow the swipe distance and settle with spring
  weight. Desktop hover, fan, and dwell transitions must preserve card
  materiality. Avoid equal-width thumbnail grids.
- Respect reduced-motion and reduced-transparency preferences.
- Keep all visible copy free of long dash punctuation.
- Use Phosphor for icons. Do not add hand-authored icon paths.

## Implementation boundaries

- `ResearchWorkspace` owns Deck lineage, historical focus, spread gestures,
  graph events, and card navigation.
- `ResearchCard` owns local rendering, its navigation hit area, selection
  capture, and its composer. It does not own Deck state.
- `GraphPreview` is a projection. It must not become the source of graph state.
- `ArticleView` renders a flat document and source trace. It does not own research
  truth or mutate the graph.
- Article compilation rules and node-to-section mapping belong in
  `article-research.ts`.
- Mock biography content, relations, and layout hints belong in
  `mock-research.ts`.
- Durable model integration should enter through a typed adapter, not component
  fetch calls distributed across the tree.
- Keep credentials and harness process control out of browser code.

## Required checks

Run before handoff:

```bash
npm run check
npm run verify:preview
npm run verify:pages
npm run verify:ui
```

Run `npm run verify:proof` after a material interaction or visual change. Inspect
the GIF, MP4, contact sheet, and all key frames in `outputs/proof/`.

## Commit conventions

- Use Conventional Commits for every commit:
  `type(scope): concise summary`.
- Prefer the narrowest useful scope, such as `graph`, `cards`, `article`,
  `docs`, or `deploy`.
- Add a short commit body for every non-mechanical change. In one to three
  sentences, state what changed and why it changed.
- Keep commit subjects imperative, specific, and under 72 characters.
- Preserve the repository owner's configured Git author. Do not mention Codex,
  agents, assistants, or generated-by tooling in authorship or commit messages.

## Deployment

This repository supports two validated outputs. The default vinext build keeps
the Sites Worker target and `.openai/hosting.json`; `npm run build:pages`
enables vinext static export and the `/lattice/` asset base for GitHub Pages.
Preserve both paths.

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
6. `app/lib/deck-motion.ts`
7. `app/lib/graph-layout.ts`
8. `app/lib/article-research.ts`
9. `app/hooks/use-mobile-deck.ts`
10. `app/components/ResearchWorkspace.tsx`
11. `app/components/ResearchCard.tsx`
12. `app/components/GraphPreview.tsx`
13. `docs/verification.md`

## Product invariants

- The showcase starts with every prepared research node visible. The graph
  projects all relations into a transitive-reduced set of primary paths, then
  reveals redundant relations only when their node is active.
- Clicking an anchor focuses an existing prepared node without changing graph
  geometry or duplicating content.
- Closing the active Card removes it and every later Card from the current Deck
  suffix, moves focus to the previous Card, and never deletes the persisted
  graph.
- A Deck is the current ordered root-to-leaf lineage. Its focus may sit on any
  Card, and Card selection inside a spread does not delete later Cards.
- Deck Spread is a desktop navigation mode, not a second content view. Hovering
  an exposed Card edge fans only that side around its matching lower corner;
  earlier Cards pivot from the lower-left and later Cards from the lower-right.
  Clicking opens the lineage.
- A sustained hover previews one Card in the center. Earlier Cards collect on
  its left and later Cards collect on its right.
- Compact reading Cards reserve touch gestures for vertical scrolling. Tapping
  an exposed left or right sheet enters a folded preview where horizontal
  swipes move only the preview focus. Tapping the centered preview commits that
  Card and returns to full reading.
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
- Article is a complete current edition after every compilation. Do not expose
  internal draft, unfinished, waiting, or developing states in the reader UI.
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
- A collapsed desktop Deck must keep its real Card edges visibly fanned at large
  viewport sizes. Only the active reading Card owns a compact contact shadow;
  dormant layers must not create moving shadow clouds or broad elevation haze.
- The desktop fan must reserve enough vertical safety space for its outer sheet.
  At short desktop heights, no Card may rise into the fixed topbar or lose its
  lower corner outside the viewport.
- Keep the workspace background optically flat. Do not reintroduce ambient
  radial gradients that can read as detached Card shadows.
- Mobile folded-preview movement must interpolate the centered Card and its
  target, settle with spring weight, and keep earlier and later Cards on
  opposite sides. Desktop edge hints must rotate around a corner rather than
  lift the stack vertically. Hover, fan, and dwell transitions must preserve
  card materiality. Avoid equal-width thumbnail grids.
- Respect reduced-motion and reduced-transparency preferences.
- Keep all visible copy free of long dash punctuation.
- Use Phosphor for icons. Do not add hand-authored icon paths.

## Implementation boundaries

- `ResearchWorkspace` owns Deck lineage, historical focus, spread gestures,
  graph events, and card navigation.
- `WorkspaceTopbar` is presentational. Keep breadcrumb, view, graph-restore, and
  theme control markup out of the workspace state component.
- `ResearchCard` owns local rendering, its navigation hit area, selection
  capture, and its composer. It does not own Deck state.
- `GraphPreview` is a projection. It must not become the source of graph state.
- `ArticleView` renders a flat document and source trace. It does not own research
  truth or mutate the graph.
- Article compilation rules and node-to-section mapping belong in
  `article-research.ts`.
- Article outline, paper, and source rail rendering belong in
  `components/article/`.
- Pure graph projection, edge routing, and hover-label geometry belong in
  `graph-layout.ts`.
- Graph path, unique-edge, mock follow-up, and selection-node helpers belong in
  `research-workspace.ts`.
- Pure Deck geometry and fixed-pivot motion math belong in `deck-motion.ts`.
- Compact preview gesture state, cancellation, and pointer capture belong in
  `use-mobile-deck.ts`.
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

Run `npm run verify:proof` and `npm run verify:mobile-proof` after a material
interaction or visual change. Inspect the GIFs, MP4s, contact sheets, and key
frames in `outputs/proof/` and `outputs/mobile-proof/`.

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

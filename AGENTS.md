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
- Follow-up questions stay inside the active node.
- User text selection creates a new sourced node.
- The graph is visible but secondary to reading.
- Prepared graph geometry stays fixed while Card focus changes. Only explicit
  user-created nodes may trigger a reflow.
- Prepared node positions are semantic layout hints, not an automatic
  topological layout. Keep the early web, space, mobility, platform, and
  synthesis strands visually distinct.
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
- Respect reduced-motion and reduced-transparency preferences.
- Keep all visible copy free of long dash punctuation.
- Use Phosphor for icons. Do not add hand-authored icon paths.

## Implementation boundaries

- `ResearchWorkspace` owns focus stack, graph events, and card navigation.
- `ResearchCard` owns only local rendering, selection capture, and its composer.
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

## Deployment

This repository supports two validated outputs. The default vinext build keeps
the Sites Worker target and `.openai/hosting.json`; `npm run build:pages`
enables vinext static export and the `/lattice/` asset base for GitHub Pages.
Preserve both paths.

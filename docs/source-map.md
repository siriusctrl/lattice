# Source map

## Entry points

- `app/page.tsx`: renders the workspace
- `app/layout.tsx`: Geist UI fonts, bundled Noto Serif SC Article font,
  language, favicon, and product metadata
- `app/globals.css`: complete light and dark visual system

## Interaction

- `app/components/ResearchWorkspace.tsx`
  - Deck lineage and independent historical focus
  - desktop edge hint, spread, and dwell preview
  - compact edge entry, folded preview, and commit-on-tap navigation
  - active-branch closing that removes the current Deck suffix, returns focus
    to the previous Card, and preserves the complete graph
  - two-phase suffix exit and persistent Explore and Article view layers
  - prepared graph state
  - custom fork creation
  - graph focus
  - custom selection nodes
  - local mock follow-ups
  - Explore and Article mode switching
  - Card-to-article and article-to-Card navigation
  - theme state

- `app/components/WorkspaceTopbar.tsx`
  - Explore and Article controls
  - compact research breadcrumb
  - graph restore and theme controls

- `app/components/ResearchCard.tsx`
  - metadata-free chat answer surface and content
  - accessible Deck navigation hit area
  - anchor rendering
  - source prompt
  - follow-up composer
  - automatic follow-up reveal
  - text selection capture
  - follow-up thinking treatment

- `app/components/GraphPreview.tsx`
  - compact and expanded graph projections
  - spring-driven active marker and contextual-edge emphasis
  - one-at-a-time hover and keyboard-focus labels above the edge layer
  - connected-path emphasis while inspecting a node
  - graph node navigation

- `app/components/ArticleView.tsx`
  - current Article section selection
  - Card-to-section focus synchronization

- `app/components/article/`
  - `ArticleOutline.tsx`: ordered navigation and source synchronization state
  - `ArticlePaper.tsx`: complete current edition and citation controls
  - `ArticleSources.tsx`: source Card rail and return navigation

## Data

- `app/lib/mock-research.ts`
  - biography node types
  - visible mock copy
  - prepared anchors
  - complete prepared graph edges
  - curated graph positions

- `app/lib/article-research.ts`
  - node-to-section mapping
  - complete current-edition compilation
  - multi-path crisis synthesis

- `app/lib/graph-layout.ts`
  - stable semantic positions and graph depth
  - transitive-reduced primary-path projection
  - curved edge routes and collision-aware hover labels

- `app/lib/research-workspace.ts`
  - root-to-node path lookup
  - unique edge insertion
  - mock follow-up responses
  - selection-node construction

- `app/lib/deck-motion.ts`
  - pure Stack, fixed-pivot fan, Spread, and folded mobile-preview geometry
  - top-sheet drag plus continuous wall-pile compression and refill geometry
  - edge-to-edge, no-return mobile handoff geometry

- `app/hooks/use-mobile-deck.ts`
  - compact Deck preview state and cancellation
  - touch pointer capture, boundary resistance, and click suppression
  - frame-coalesced gesture updates and deterministic layer handoff
  - Escape, viewport, and selection cleanup

- `app/hooks/use-deck-transition.ts`
  - managed outgoing-suffix state
  - delayed lineage commit and retained-Card focus restoration

## Assets

- `public/og.png`: social preview of Explore becoming Article
- `public/favicon.svg`: Lattice stacked-card mark

## Verification

- `playwright.config.ts`: desktop browser verification environment
- `playwright.mobile.config.ts`: iPhone-sized WebKit verification environment
- `tests/mobile-webkit.spec.ts`: Safari-engine six-Card, whole-pile
  monotonicity, layer-ownership, and commit-continuity regression
- `tests/workspace.spec.ts`: Deck, interaction, DAG, selection, theme, and mobile
  tests, including top-Card and historical middle-Card unstack regressions,
  retained-Card DOM identity, view-state preservation, compact graph identity,
  mobile top-sheet ownership and six-Card pile continuity before, during, and
  after a swipe, short-desktop topbar clearance, and current-edition Article
  coverage
- `tests/deck-motion.spec.ts`: frame-sampled fan continuity, fixed pivots, and
  hinted-fan to Spread transition coverage
- `tests/rendered-html.test.mjs`: production Worker HTML checks
- `scripts/check-content.mjs`: copy and starter-removal gate
- `scripts/record-demo.mjs`: deterministic complete UI recording
- `scripts/render-proof.sh`: GIF, MP4, and contact sheet production
- `scripts/record-mobile-demo.mjs`: deterministic touch-based mobile recording,
  including left and right drag and handoff frames
- `scripts/render-mobile-proof.sh`: mobile GIF, MP4, and contact sheet production
- `tests/static-pages.test.mjs`: GitHub Pages static-export contract
- `.github/workflows/pages.yml`: project Pages build and deployment

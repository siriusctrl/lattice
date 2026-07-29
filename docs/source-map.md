# Source map

## Entry points

- `app/page.tsx`: renders the workspace
- `app/layout.tsx`: fonts, language, favicon, and product metadata
- `app/globals.css`: complete light and dark visual system

## Interaction

- `app/components/ResearchWorkspace.tsx`
  - Deck lineage and independent historical focus
  - desktop edge hint, spread, and dwell preview
  - compact edge entry, folded preview, and commit-on-tap navigation
  - active-branch closing that removes the current Deck suffix, returns focus
    to the previous Card, and preserves the complete graph
  - prepared graph state
  - custom fork creation
  - graph focus
  - custom selection nodes
  - local mock follow-ups
  - Explore and Article mode switching
  - Card-to-article and article-to-Card navigation
  - theme state

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
  - transitive-reduced primary-path projection
  - curved routes over stable semantic positions
  - spring-driven active marker and contextual-edge emphasis
  - one-at-a-time hover and keyboard-focus labels above the edge layer
  - connected-path emphasis while inspecting a node
  - graph node navigation

- `app/components/ArticleView.tsx`
  - continuous article surface
  - ordered section navigation
  - synthesis and developing states
  - source Card rail

## Data

- `app/lib/mock-research.ts`
  - biography node types
  - visible mock copy
  - prepared anchors
  - complete prepared graph edges
  - curated graph positions

- `app/lib/article-research.ts`
  - node-to-section mapping
  - incremental section compilation
  - multi-path crisis synthesis

- `app/lib/deck-motion.ts`
  - pure Stack, fixed-pivot fan, Spread, and folded mobile-preview geometry

- `app/hooks/use-mobile-deck.ts`
  - compact Deck preview state and cancellation
  - touch pointer capture, boundary resistance, and click suppression
  - Escape, viewport, and selection cleanup

## Assets

- `public/og.png`: social preview of Explore becoming Article
- `public/favicon.svg`: Lattice stacked-card mark

## Verification

- `playwright.config.ts`: desktop browser verification environment
- `tests/workspace.spec.ts`: Deck, interaction, DAG, selection, theme, and mobile
  tests, including top-Card and historical middle-Card unstack regressions
- `tests/deck-motion.spec.ts`: frame-sampled fan continuity, fixed pivots, and
  hinted-fan to Spread transition coverage
- `tests/rendered-html.test.mjs`: production Worker HTML checks
- `scripts/check-content.mjs`: copy and starter-removal gate
- `scripts/record-demo.mjs`: deterministic complete UI recording
- `scripts/render-proof.sh`: GIF, MP4, and contact sheet production
- `scripts/record-mobile-demo.mjs`: deterministic touch-based mobile recording
- `scripts/render-mobile-proof.sh`: mobile GIF, MP4, and contact sheet production
- `tests/static-pages.test.mjs`: GitHub Pages static-export contract
- `.github/workflows/pages.yml`: project Pages build and deployment

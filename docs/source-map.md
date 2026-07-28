# Source map

## Entry points

- `app/page.tsx`: renders the workspace
- `app/layout.tsx`: fonts, language, favicon, and product metadata
- `app/globals.css`: complete light and dark visual system

## Interaction

- `app/components/ResearchWorkspace.tsx`
  - focus stack
  - direct active-branch closing
  - fork creation
  - converging DAG edges
  - graph focus
  - custom selection nodes
  - local mock follow-ups
  - Explore and Article mode switching
  - Card-to-article and article-to-Card navigation
  - theme state

- `app/components/ResearchCard.tsx`
  - metadata-free chat answer surface and content
  - anchor rendering
  - source prompt
  - follow-up composer
  - text selection capture
  - loading treatment

- `app/components/GraphPreview.tsx`
  - compact and expanded graph projections
  - layered layout recomputed from the visible DAG
  - crowded-label suppression and hover reveal
  - potential and discovered node styling
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
  - possible graph edges
  - graph ordering hints

- `app/lib/article-research.ts`
  - node-to-section mapping
  - incremental section compilation
  - multi-path crisis synthesis

## Assets

- `public/og.png`: social preview of Explore becoming Article
- `public/favicon.svg`: Lattice stacked-card mark

## Verification

- `playwright.config.ts`: desktop browser verification environment
- `tests/workspace.spec.ts`: interaction, DAG, selection, theme, and mobile tests
- `tests/rendered-html.test.mjs`: production Worker HTML checks
- `scripts/check-content.mjs`: copy and starter-removal gate
- `scripts/record-demo.mjs`: deterministic complete UI recording
- `scripts/render-proof.sh`: GIF, MP4, and contact sheet production

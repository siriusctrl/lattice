# Source map

## Entry points

- `app/page.tsx`: renders the host-selecting app shell
- `app/notes/beyond-linear-chat/page.tsx`: Chinese public design note
- `app/en/notes/beyond-linear-chat/page.tsx`: English public design note
- `app/components/LatticeApp.tsx`: selects DemoHost by default and accepts a
  trusted local ACP bootstrap
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
  - prepared or hydrated graph state
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

- `app/components/essay/`
  - `EssayShell.tsx`: standalone article structure, language routes, contents,
    and return links
  - `EssayDocumentLanguage.tsx`: narrowly scoped client sync for route language
  - `ConversationShapeHero.tsx`: accessible responsive line drawing of chat,
    Card and graph structure, and flat reading
  - `EssayThemeToggle.tsx`: persisted light and dark appearance
  - `EssayPage.module.css`: isolated editorial layout and responsive type

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
  - repository-backed flat Article compilation

- `app/lib/graph-layout.ts`
  - stable semantic positions and graph depth
  - transitive-reduced primary-path projection
  - curved edge routes and collision-aware hover labels

- `app/lib/research-workspace.ts`
  - root-to-node path lookup
  - unique edge insertion
  - selection-node construction

- `app/lib/lattice-host.ts`
  - browser-safe host request, event, result, and cancellation protocol
  - streamed follow-up consumption and navigation generation guards

- `app/lib/demo-host.ts`
  - deterministic static-site follow-up and selection behavior

- `app/lib/acp-host.ts`
  - authenticated ACP sidecar session and SSE client
  - ACP message/tool events mapped into Lattice results
  - project-backed hydration, durable patches, and UI-state persistence

- `app/content/beyond-linear-chat.ts`
  - independently localized Chinese and English article editions

- `public/beyond-linear-chat.svg` and `public/beyond-linear-chat.png`
  - restrained line-drawn article cover and its social-preview raster

- `app/lib/site-paths.ts`
  - GitHub Pages base-aware links and absolute metadata URLs

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

## Local runtimes

- `plugins/lattice/`
  - Codex plugin manifest and skill
  - stdio MCP server and native MCP Apps widget
  - project-local multi-workspace `.lattice` catalog and revision locking
  - conversation-seeded, blank, and legacy workspace launch semantics

- `.agents/plugins/marketplace.json`
  - local Codex marketplace entry for the Lattice plugin

- `integrations/acp/`
  - ACP v1 stdio client
  - authenticated loopback HTTP/SSE sidecar
  - shared project-local `.lattice` workspace storage boundary
  - Codex and Claude Code presets
  - process, timeout, cancellation, and permission lifecycle tests

## Verification

- `playwright.config.ts`: desktop browser verification environment
- `playwright.mobile.config.ts`: iPhone-sized WebKit verification environment
- `tests/mobile-webkit.spec.ts`: Safari-engine six-Card, whole-pile
  monotonicity, layer-ownership, and commit-continuity regression
- `tests/essay.spec.ts`: route entry, language switching, mobile containment,
  responsive diagram, return navigation, and theme persistence
- `tests/workspace.spec.ts`: Deck, interaction, DAG, selection, theme, and mobile
  tests, including top-Card and historical middle-Card unstack regressions,
  retained-Card DOM identity, view-state preservation, compact graph identity,
  mobile top-sheet ownership and six-Card pile continuity before, during, and
  after a swipe, short-desktop topbar clearance, and current-edition Article
  coverage
- `tests/deck-motion.spec.ts`: frame-sampled fan continuity, fixed pivots, and
  hinted-fan to Spread transition coverage
- `tests/lattice-host.spec.ts`: DemoHost and AcpHost protocol, streaming,
  cancellation, error recovery, and stale-run regression coverage
- `tests/rendered-html.test.mjs`: production Worker workspace and localized
  essay SSR checks
- `scripts/check-content.mjs`: copy and starter-removal gate
- `scripts/record-demo.mjs`: deterministic complete UI recording
- `scripts/render-proof.sh`: GIF, MP4, and contact sheet production
- `scripts/record-mobile-demo.mjs`: deterministic touch-based mobile recording,
  including left and right drag and handoff frames
- `scripts/render-mobile-proof.sh`: mobile GIF, MP4, and contact sheet production
- `tests/static-pages.test.mjs`: GitHub Pages workspace and bilingual essay
  static-export contract
- `.github/workflows/pages.yml`: project Pages build and deployment

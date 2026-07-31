# Verification

## Required chain

```bash
npm run check
npm run verify:preview
npm run verify:pages
npm run verify:ui
npm run verify:mobile-ui
```

`check` runs TypeScript, ESLint, and visible-copy policy checks.

The static gates intentionally run with no ACP bootstrap. This proves the
published website remains the complete deterministic demo.

`verify:preview` creates the production vinext build and executes the built
Worker against an HTML request. It proves that product metadata, the Musk
scenario, graph shell, and both localized design essays render without the
disposable starter preview.

`verify:pages` builds vinext in static-export mode and confirms that the
interactive entrypoint, both essay routes, localized metadata, reciprocal
language links, `.nojekyll`, and `/lattice/` asset URLs are ready for GitHub
Pages.

`verify:ui` launches Chromium and checks:

- immediate prepared-card navigation without a hover preview or generation state
- top-Card closing that removes the active Deck suffix, returns focus to the
  previous Card, and preserves its node in the complete graph
- historical middle-Card closing after Deck Spread selection, including removal
  of that Card and every later Card from the Deck while their graph nodes remain
- frame-level middle-Card closing behavior: the primary sheet begins a bounded
  settle-back motion while still opaque, later suffix sheets stop painting, the
  retained Card never drops opacity, and its DOM identity survives the state
  commit
- mirrored same-side lower-corner fans, desktop Deck Spread, and dwell preview
  partition without stationary-pointer preview chaining
- legible dormant Card edges at large desktop widths, stable active-Card
  contact shadow on a flat workspace without broad haze, and intact suffix
  history after returning to the root Card
- a deep five-Card fan staying below the topbar at a 1512 by 822 desktop
  viewport while preserving lower-corner clearance
- vertical-only mobile reading, edge-triggered folded preview, preview-only
  swipes, top-sheet drag ownership, six-Card wall-pile compression and refill,
  monotonic edge-to-edge stacking handoff, and tap-to-commit with opposite Card
  peeks
- the complete 21-node map, 25 primary paths, and 46 retained semantic
  relations at first render
- curved graph paths reaching both endpoint centers without clipping
- stable graph geometry and smooth active-focus movement during Card navigation
- consistent hover and keyboard-focus labels that render above graph edges
- connected-path emphasis and unrelated-edge quieting during graph inspection
- the prepared converging SpaceX and Tesla DAG
- local follow-up loading, completion, and automatic reveal
- user text selection forks
- Explore and Article view switching without remounting Cards or clearing an
  unsent composer draft
- a complete, richly populated current Article edition with no internal
  unfinished-state copy
- self-hosted Noto Serif SC Article typography within the restrained desktop
  scale, with no redundant live-rewrite status field
- user-selected research notes compiling into a new current Article edition
- article source links returning to original Cards
- light and dark theme persistence
- Explore and Article mobile viewport containment
- navigation from the workspace to the Chinese design note and back
- independently localized Chinese and English article routes
- responsive desktop and mobile line drawings without horizontal overflow
- essay contents navigation and persisted light or dark appearance

`verify:mobile-ui` repeats a six-Card right-swipe trajectory in an iPhone-sized
WebKit runtime. It samples every visible Card throughout the gesture, rejects
direction reversal, an offscreen-return peak, or a post-commit position or
opacity jump, and confirms that a pile edge enters or leaves continuously while
the outgoing sheet owns the higher layer until the surfaces meet.

## Runtime package checks

The Codex plugin and ACP sidecar are independent packages:

```bash
cd plugins/lattice
npm ci --ignore-scripts
npm run quality

cd ../../integrations/acp
npm ci
npm test
npm run probe
```

The plugin probe starts two MCP processes to exercise cross-process revision
conflicts. It also checks independent workspace creation and selection, legacy
flat-layout compatibility, immutable retry behavior, hardlink rejection, DAG
cycle rejection, output schemas, native widget packaging, attribute escaping,
and the request-to-revision completion loop.

The ACP tests use disposable fake agents to cover initialize, session creation,
blank workspace creation and hydration, workspace selection, streaming,
permissions, cancellation, timeout, malformed responses, missing executables,
EPIPE, default MCP-process rejection, slow SSE consumers, and shutdown. The
probe exercises the public HTTP/SSE API end to end without spending a model
call.

## Visual proof

Run:

```bash
npm run verify:proof
npm run verify:mobile-proof
```

This produces:

- `outputs/lattice-demo.gif`
- `outputs/lattice-demo.mp4`
- `outputs/lattice-demo.webm`
- `outputs/lattice-contact-sheet.png`
- key PNG frames under `outputs/proof/`

The mobile proof additionally produces:

- `outputs/lattice-mobile-demo.gif`
- `outputs/lattice-mobile-demo.mp4`
- `outputs/lattice-mobile-demo.webm`
- `outputs/lattice-mobile-contact-sheet.png`
- key PNG frames under `outputs/mobile-proof/`

It records real touch input at 390 by 844, including native vertical reading,
edge entry, folded browsing, both directional top-sheet drags and edge-to-edge
handoffs, tap-to-commit, and the final mobile Article typography.

The recording follows one deterministic path:

1. open the Musk root card
2. build a five-Card early-life Deck and inspect the fixed lower-left fan
3. open Deck Spread, return to a historical Card, and inspect the mirrored fan
4. close that historical Card through a captured in-motion frame, then verify
   the settled Deck suffix
5. fork to SpaceX and then the 2008 crisis
6. inspect the completed flat article
7. return through a source Card and reach the same crisis through Tesla
8. expand the full graph, inspect a node label, and switch to dark mode
9. inspect the two-path article synthesis
10. return to Tesla and visibly complete a local follow-up
11. select source text, create a custom fork, and inspect its place in the article

Inspect both themes, graph legibility, card depth, focus movement, composer
feedback, the final multi-parent crisis node, Article readability, and source
traceability before handoff.

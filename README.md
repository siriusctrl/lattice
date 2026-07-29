# Lattice

Lattice is a high-fidelity prototype for graph-native AI research. This
showcase opens on a completed research artifact: the user browses its full DAG
through stacked conversation cards, can continue asking local questions, and
can read the same material as one flat article.

The included scenario explores Elon Musk's biography through more than twenty
prepared nodes spanning early life, internet companies, industrial systems,
energy, infrastructure, brain-computer interfaces, X, xAI, management, and
risk. Independent branches can converge on shared events or interpretations.

## What works

- See the complete prepared node map before opening any branch.
- Click a thin underlined anchor to open its existing conversation card.
- Keep asking questions inside the active card.
- Select ordinary answer text and create a user-defined fork.
- Close the active branch directly from the Card corner. Closing removes that
  Card and every later Card from the current Deck, returns focus to the previous
  Card, and leaves the complete research graph intact.
- Approach an exposed Card edge to open that side around its matching lower
  corner, then click it to spread the current path across the desktop workspace.
- Rest on a Card to preview it between earlier Cards on the left and later
  Cards on the right.
- On phone widths, tap an exposed Stack edge to enter a folded preview. Swipe
  that preview without changing context, then tap the centered Card to open it.
- Reopen material from the breadcrumb or research graph.
- Reach one node from multiple branches without duplicating it.
- Expand, minimize, and close the live graph preview.
- Move through Cards without moving the graph geometry; the map keeps a curated
  semantic composition while the active marker and contextual relations
  transition.
- Switch between the original Explore workspace and a continuous Article.
- Add local follow-ups or selected-text forks without rewriting prepared Cards.
- Trace any article section back to the Card conversations that produced it.
- Switch between carefully matched light and dark themes.
- Use the layout on desktop and mobile widths.

This version uses a deterministic, completed mock research artifact. The
interaction contract is real, including the distinction between original
conversation, graph provenance, local follow-ups, and the compiled article.
Model calls and persistence are the next implementation layer.

## Quick start

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Technology choice

The frontend is TypeScript, React 19, Next-compatible app routes through vinext,
Tailwind CSS 4 tokens, Motion, and Phosphor icons. The production build targets
Cloudflare Workers through Sites.

A web product is not limited to viewing content. The browser should own
interaction, animation, selection, and streamed rendering. A Worker, server
route, or local sidecar should own credentials, file access, model calls, and
Codex or Claude Code process control. The boundary looks like this:

```text
React Explore and Article workspace
        |
   SSE or WebSocket
        |
Model gateway or local sidecar
        |
Codex, Claude Code, or direct model API
```

TypeScript is a good fit because the same event types can describe browser
actions, streamed model events, graph updates, and adapter capabilities. A
desktop shell can be added later if local process and file permissions need a
native installation, without rewriting the React interface.

See [docs/architecture.md](docs/architecture.md) for the intended boundary.

## Verification

```bash
npm run check
npm run verify:preview
npm run verify:pages
npm run verify:ui
npm run verify:proof
npm run verify:mobile-proof
```

`verify:proof` records the complete interaction, produces a GIF and MP4, and
builds a contact sheet from key states. `verify:mobile-proof` does the same for
the edge-triggered folded preview using real touch input.

`verify:pages` creates the static `/lattice/` build used by
[siriusctrl.github.io/lattice](https://siriusctrl.github.io/lattice/). Pushes
to `main` publish that build through `.github/workflows/pages.yml`.

See [docs/verification.md](docs/verification.md) for the exact proof contract.

## Repository map

- [AGENTS.md](AGENTS.md): maintainer and agent handoff
- [docs/INDEX.md](docs/INDEX.md): documentation entry point
- [docs/source-map.md](docs/source-map.md): file ownership and reading path
- `app/components/ResearchWorkspace.tsx`: interaction state and navigation
- `app/components/ResearchCard.tsx`: plain chat content, Deck hit area, anchors, selection, follow-ups
- `app/components/ArticleView.tsx`: flat article and source-card traceability
- `app/components/GraphPreview.tsx`: compact and expanded graph
- `app/hooks/use-mobile-deck.ts`: mobile folded-preview gesture state
- `app/lib/article-research.ts`: incremental article compiler fixture
- `app/lib/mock-research.ts`: Musk research fixture, relations, and layout hints
- `scripts/record-demo.mjs`: deterministic browser recording
- `scripts/record-mobile-demo.mjs`: deterministic mobile touch recording

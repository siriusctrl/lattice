# Lattice

Lattice is a high-fidelity prototype for graph-native AI research. The user
explores naturally through stacked conversation cards while the product keeps
the research graph and continuously compiles useful material into one flat,
readable article.

The included scenario explores Elon Musk's biography. It is intentionally rich
enough to demonstrate a tree becoming a DAG when the SpaceX and Tesla branches
both converge on the 2008 crisis.

## What works

- Click a thin underlined anchor to fork a new card.
- Keep asking questions inside the active card.
- Select ordinary answer text and create a user-defined fork.
- Close the active branch directly from the Card header.
- Reopen explored material from the breadcrumb or research graph.
- Reopen discovered nodes from the graph preview.
- Reach one node from multiple branches without duplicating it.
- Expand, minimize, and close the live graph preview.
- Switch between the original Explore workspace and a continuous Article.
- Watch article sections grow from draft to cross-branch synthesis.
- Trace any article section back to the Card conversations that produced it.
- Jump from a Card directly to its location in the article.
- Switch between carefully matched light and dark themes.
- Use the layout on desktop and mobile widths.

This version uses a deterministic mock research model. The interaction contract
is real, including the distinction between original conversation, exploration
provenance, and the compiled article. Model calls and persistence are the next
implementation layer.

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
npm run verify:ui
npm run verify:proof
```

`verify:proof` records the complete interaction, produces a GIF and MP4, and
builds a contact sheet from key states.

See [docs/verification.md](docs/verification.md) for the exact proof contract.

## Repository map

- [AGENTS.md](AGENTS.md): maintainer and agent handoff
- [docs/INDEX.md](docs/INDEX.md): documentation entry point
- [docs/source-map.md](docs/source-map.md): file ownership and reading path
- `app/components/ResearchWorkspace.tsx`: interaction state and navigation
- `app/components/ResearchCard.tsx`: card content, anchors, selection, follow-ups
- `app/components/ArticleView.tsx`: flat article and source-card traceability
- `app/components/GraphPreview.tsx`: compact and expanded graph
- `app/lib/article-research.ts`: incremental article compiler fixture
- `app/lib/mock-research.ts`: Musk research fixture and graph coordinates
- `scripts/record-demo.mjs`: deterministic browser recording

## Image notes

The Elon Musk portrait is credited to The Royal Society and Debbie Rowe under
CC BY-SA 4.0 through Wikimedia Commons. The rocket and early electric roadster
images were generated specifically for this prototype with the built-in OpenAI
image generation workflow. The social preview image was also generated for this
project from the finished Explore and Article interfaces.

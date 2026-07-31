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
  Card through one continuous unstack motion, and leaves the complete research
  graph intact.
- Approach an exposed Card edge to open that side around its matching lower
  corner, then click it to spread the current path across the desktop workspace.
- Rest on a Card to preview it between earlier Cards on the left and later
  Cards on the right.
- On phone widths, tap an exposed Stack edge to enter a folded preview. The
  centered Card stays above the Deck while it follows the swipe, settles
  directly into the opposite-side peek, and hands its layer to the next Card
  only after their visible surfaces stop overlapping. Cards already against
  that wall compress deeper as one pile while the opposite pile advances into
  the opened space, so no extra paper edges appear at the end of the gesture.
  Tap the centered Card to open it.
- Reopen material from the breadcrumb or research graph.
- Reach one node from multiple branches without duplicating it.
- Expand, minimize, and close the live graph preview.
- Move through Cards without moving the graph geometry; the map keeps a curated
  semantic composition while the active marker and contextual relations
  transition.
- Switch between the original Explore workspace and a continuous Article
  without resetting Card drafts, scroll position, or spatial history.
- Add local follow-ups or selected-text forks without rewriting prepared Cards.
- Read Article as a complete current edition at every point. New research
  recompiles and expands the prose instead of exposing internal draft states.
- Trace any article section back to the Card conversations that produced it.
- Read the product argument as a standalone Chinese or English design essay,
  with localized prose rather than one mechanically translated document.
- Switch between carefully matched light and dark themes.
- Use the layout on desktop and mobile widths.

The published site uses a deterministic, completed mock research artifact. The
same workspace now also has a typed host boundary, a source-complete Codex MCP
Apps plugin, and an ACP v1 sidecar/browser host for Codex or Claude Code. Those
local sidecar and plugin runtimes stay outside the default static deployment;
the browser ACP host remains dormant unless a trusted local connection is
injected.

## Quick start

Requirements:

- Node.js 22.13 or newer
- npm

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Run with Codex or Claude Code

The static site stays a deterministic demo. To turn the same React workspace
into a repository-backed client, keep the dev server running and start the ACP
sidecar in a second terminal:

Authenticate the harness you intend to use first:

```bash
codex login status
# or
claude auth status
```

```bash
# Terminal 1, from the repository root
npm install
npm run dev

# Terminal 2, research with Codex
npm --prefix integrations/acp ci
npm --prefix integrations/acp test
node integrations/acp/dist/cli.js \
  --preset codex \
  --cwd /absolute/path/to/project \
  --lattice-url http://localhost:3000/
```

For Claude Code, change only the preset:

```bash
node integrations/acp/dist/cli.js \
  --preset claude \
  --cwd /absolute/path/to/project \
  --lattice-url http://localhost:3000/
```

Open the `workspaceUrl` printed by the sidecar. Starting the sidecar without
`--workspace-id` creates a new blank workspace. Its first question creates the
root Card; later follow-ups, selected-text forks, graph edges, and reading
position are hydrated from and persisted to that workspace:

```text
<project>/.lattice/
├── workspaces.json
└── workspaces/
    └── <workspace-id>/
        ├── workspace.json
        ├── events.ndjson
        └── ui-state.json
```

The sidecar is bound to that project path. Codex and Claude credentials stay in
their own harness configuration and are never written to `.lattice/`.

## Install the local Codex plugin

> **Publication status:** Lattice has not been uploaded to a remote or public
> Codex marketplace. This repository only contains a local marketplace
> manifest. The commands below register this checkout on your current machine;
> they do not publish it.

Install the locked plugin dependencies, register the repository as a local
marketplace, and install `lattice` from that local source:

```bash
cd /absolute/path/to/lattice
npm --prefix plugins/lattice ci --ignore-scripts
npm --prefix plugins/lattice run quality

codex plugin marketplace add /absolute/path/to/lattice
codex plugin add lattice@personal
codex plugin list
```

If this checkout is already listed as a marketplace, skip the
`marketplace add` command and run `codex plugin add lattice@personal`.

To use it, choose the launch that matches your context:

1. Start a new Codex task so the newly installed skill and MCP server load.
2. Open the repository you actually want to research. It does not need to be
   the Lattice source repository.
3. While discussing a topic, ask `Turn this conversation into a Lattice
   research workspace.` Codex creates a new conversation workspace, uses the
   current task history to initialize its first research graph, and opens it.
4. To start without prior context, ask `Open a blank Lattice workspace for this
   project.` Codex creates an empty workspace and opens a blank chat surface.
5. To resume, ask Codex to list the project's Lattice workspaces and open one.
6. Continue the remaining interaction in the native Lattice workspace.

Every launch creates an independent workspace, even when `.lattice/` already
exists. Research is stored under the active target repository, not under the
Lattice checkout:

```text
<target-project>/.lattice/workspaces.json
<target-project>/.lattice/workspaces/<workspace-id>/workspace.json
<target-project>/.lattice/workspaces/<workspace-id>/events.ndjson
<target-project>/.lattice/workspaces/<workspace-id>/ui-state.json
```

The native widget and the ACP workspace use this same schema, so either surface
can continue the same research graph by workspace id. Existing repositories
with the original flat `.lattice/workspace.json` layout expose it as a legacy
workspace without moving or deleting it. A
`codex://plugins/...marketplacePath=` link only opens this local plugin entry in
Codex; it is not evidence that the plugin has been uploaded.

The plugin and ACP packages are local runtimes. Installing or running them does
not change the Cloudflare Sites or GitHub Pages static deployment.

## Technology choice

The frontend is TypeScript, React 19, Next-compatible app routes through vinext,
Tailwind CSS 4 tokens, Motion, Phosphor icons, and a self-hosted Noto Serif SC
variable font for Article typography. The production build targets Cloudflare
Workers through Sites.

A web product is not limited to viewing content. The browser should own
interaction, animation, selection, and streamed rendering. A Worker, server
route, or local sidecar should own credentials, file access, model calls, and
Codex or Claude Code process control. The boundary looks like this:

```text
React Explore and Article workspace
        |
   LatticeHost event protocol
        |
  +-----+------------------+
  |                        |
DemoHost             AcpHost over HTTP/SSE
                           |
                     ACP sidecar
                           |
                  Codex or Claude Code
```

TypeScript is a good fit because the same event types can describe browser
actions, streamed model events, graph updates, and adapter capabilities. A
separate Codex plugin serves a native fullscreen MCP Apps widget and persists
its graph under the active project's `.lattice/` directory.

See [docs/architecture.md](docs/architecture.md) for the product boundary and
[docs/runtime-integrations.md](docs/runtime-integrations.md) for the runnable
surfaces.

## Verification

```bash
npm run check
npm run verify:preview
npm run verify:pages
npm run verify:ui
npm run verify:mobile-ui
npm run verify:proof
npm run verify:mobile-proof
```

`verify:proof` records the complete interaction, produces a GIF and MP4, and
builds a contact sheet from key states. `verify:mobile-proof` does the same for
the edge-triggered folded preview using real touch input. `verify:mobile-ui`
repeats the monotonic right-swipe contract in mobile WebKit.

`verify:pages` creates the static `/lattice/` build used by
[siriusctrl.github.io/lattice](https://siriusctrl.github.io/lattice/). Pushes
to `main` publish that build through `.github/workflows/pages.yml`.

The public design note is available in
[Chinese](https://siriusctrl.github.io/lattice/notes/beyond-linear-chat) and
[English](https://siriusctrl.github.io/lattice/en/notes/beyond-linear-chat).

See [docs/verification.md](docs/verification.md) for the exact proof contract.

## Repository map

- [AGENTS.md](AGENTS.md): maintainer and agent handoff
- [docs/INDEX.md](docs/INDEX.md): documentation entry point
- [docs/source-map.md](docs/source-map.md): file ownership and reading path
- `app/components/ResearchWorkspace.tsx`: interaction state and navigation
- `app/components/LatticeApp.tsx`: DemoHost default and trusted local ACP
  bootstrap
- `app/components/WorkspaceTopbar.tsx`: Explore, Article, breadcrumb, graph, and
  theme controls
- `app/components/ResearchCard.tsx`: plain chat content, Deck hit area, anchors, selection, follow-ups
- `app/components/ArticleView.tsx`: Article selection and focus orchestration
- `app/components/article/`: flat article outline, paper, and source rail
- `app/components/essay/`: bilingual public essay shell, theme control, and
  line-drawn conversation-to-knowledge header
- `app/content/beyond-linear-chat.ts`: independently written Chinese and
  English essay editions
- `app/components/GraphPreview.tsx`: compact and expanded graph
- `app/hooks/use-deck-transition.ts`: two-phase Deck suffix exit and commit
- `app/hooks/use-mobile-deck.ts`: mobile folded-preview gesture state
- `app/lib/article-research.ts`: current-edition article compiler fixture
- `app/lib/graph-layout.ts`: pure graph projection and label geometry
- `app/lib/research-workspace.ts`: graph path, follow-up, and selection-fork
  helpers
- `app/lib/mock-research.ts`: Musk research fixture, relations, and layout hints
- `app/lib/lattice-host.ts`: shared streamed host protocol
- `app/lib/demo-host.ts`: deterministic static-site implementation
- `app/lib/acp-host.ts`: browser HTTP/SSE implementation
- `app/lib/site-paths.ts`: base-aware public routes and absolute metadata URLs
- `plugins/lattice/`: native Codex MCP Apps plugin
- `integrations/acp/`: Codex and Claude Code ACP sidecar
- `scripts/record-demo.mjs`: deterministic browser recording
- `scripts/record-mobile-demo.mjs`: deterministic mobile touch recording

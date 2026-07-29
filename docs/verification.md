# Verification

## Required chain

```bash
npm run check
npm run verify:preview
npm run verify:pages
npm run verify:ui
```

`check` runs TypeScript, ESLint, and visible-copy policy checks.

`verify:preview` creates the production vinext build and executes the built
Worker against an HTML request. It proves that product metadata, the Musk
scenario, and the graph shell render without the disposable starter preview.

`verify:pages` builds vinext in static-export mode and confirms that the
interactive entrypoint, metadata, `.nojekyll`, and `/lattice/` asset URLs are
ready for GitHub Pages.

`verify:ui` launches Chromium and checks:

- immediate prepared-card navigation without a hover preview or generation state
- direct active-card closing without graph deletion
- the complete 21-node map, 25 primary paths, and 46 retained semantic
  relations at first render
- curved graph paths reaching both endpoint centers without clipping
- stable graph geometry and smooth active-focus movement during Card navigation
- consistent hover and keyboard-focus labels that render above graph edges
- connected-path emphasis and unrelated-edge quieting during graph inspection
- the prepared converging SpaceX and Tesla DAG
- local follow-up loading, completion, and automatic reveal
- user text selection forks
- Explore and Article view switching
- complete article synthesis and user-added research-note states
- article source links returning to original Cards
- light and dark theme persistence
- Explore and Article mobile viewport containment

## Visual proof

Run:

```bash
npm run verify:proof
```

This produces:

- `outputs/lattice-demo.gif`
- `outputs/lattice-demo.mp4`
- `outputs/lattice-demo.webm`
- `outputs/lattice-contact-sheet.png`
- key PNG frames under `outputs/proof/`

The recording follows one deterministic path:

1. open the Musk root card
2. fork to SpaceX
3. fork to the 2008 crisis
4. inspect the completed flat article
5. return through a source Card and reach the same crisis through Tesla
6. expand the full graph, inspect a node label, and switch to dark mode
7. inspect the two-path article synthesis
8. return to Tesla and visibly complete a local follow-up
9. select source text, create a custom fork, and inspect its place in the article

Inspect both themes, graph legibility, card depth, focus movement, composer
feedback, the final multi-parent crisis node, Article readability, and source
traceability before handoff.

# Verification

## Required chain

```bash
npm run check
npm run verify:preview
npm run verify:ui
```

`check` runs TypeScript, ESLint, and visible-copy policy checks.

`verify:preview` creates the production vinext build and executes the built
Worker against an HTML request. It proves that product metadata, the Musk
scenario, and the graph shell render without the disposable starter preview.

`verify:ui` launches Chromium and checks:

- anchor fork creation
- direct active-card closing without graph deletion
- graph node counts
- graph edges reaching both endpoint centers without path clipping
- a converging SpaceX and Tesla DAG
- local follow-up loading and completion
- user text selection forks
- Explore and Article view switching
- incomplete and converged article section states
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
4. inspect the first flat article draft
5. return through a source Card and reach the crisis through Tesla
6. expand the converged graph and switch to dark mode
7. inspect the updated two-path article synthesis
8. return to Tesla, ask a local follow-up, and select source text
9. create a custom fork and inspect its place in the final article

Inspect both themes, graph legibility, card depth, focus movement, composer
feedback, the final multi-parent crisis node, Article readability, and source
traceability before handoff.

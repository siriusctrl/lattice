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
- card back and forward behavior
- graph node counts
- a converging SpaceX and Tesla DAG
- local follow-up loading and completion
- user text selection forks
- light and dark theme persistence
- mobile viewport containment

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
4. expand the graph and switch to dark mode
5. return to the root
6. reach the same crisis through Tesla
7. ask a local follow-up
8. select answer text and create a custom fork
9. expand the final graph

Inspect both themes, graph legibility, card depth, focus movement, composer
feedback, and the final multi-parent crisis node before handoff.

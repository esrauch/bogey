# The Bogey

A solitaire card game by Katharine Turner, built with TypeScript and HTML5 Canvas.

## Prerequisites

- [Node.js](https://nodejs.org/) (for `npm` and `npx`)

## Build

```bash
npm install
npm run build
```

This compiles `src/*.ts` → `dist/*.js` using the TypeScript compiler.

To watch for changes and rebuild automatically:

```bash
npm run watch
```

## Run

Serve the project root with any static HTTP server. For example:

```bash
npx -y serve .
```

Then open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
bogey/
├── index.html          # Entry point — loads dist/main.js as ES module
├── src/
│   ├── main.ts         # Bootstrap, game loop, event wiring
│   ├── game.ts         # Game state, turn flow, legal move validation
│   ├── renderer.ts     # All canvas drawing
│   ├── card.ts         # Card/Suit/Rank types, deck utilities
│   ├── animation.ts    # Tweening system
│   └── audio.ts        # Synthesized sound effects (Web Audio API)
├── dist/               # Compiled JS output (git-ignored)
├── tsconfig.json
├── package.json
└── RULES.md            # Full game rules
```

## Game Rules

See [RULES.md](RULES.md) for the complete rules.

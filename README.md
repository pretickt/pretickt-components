# pretickt components

Angular standalone components that answer one market question each, rendered at build time by the official Angular compiler's
server bundle and hydrated in the browser when they scroll into view. Data comes from closed pretickt APIs through `Pt`; this
repository holds the components, the design system (`styles/ds.css`, formatting, primitives), the typologies (data contracts with
deterministic demo data), the indicators and the page app. How to write a component: [CLAUDE.md](CLAUDE.md).

```sh
npm test            # Vitest (typologies, indicators, checks, scripts) + ng test (components, design system, page app)
npm run typecheck   # tsc
npm run build       # dist/: site/browser (/c/), site/server, ds.css, index.json
npm run check       # server checks, concurrent renders, hydration
```

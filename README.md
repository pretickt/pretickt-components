# pretickt components

Vue single-file components that answer one market question each, rendered on the server at build time and hydrated in the
browser as islands. Data comes from closed pretickt APIs through `usePt()`; this repository holds the components, the design
system (`styles/ds.css`, formatting, a few primitives), the typologies (data contracts with deterministic demo data), the indicators
and the islands runtime. How to write a component: [CLAUDE.md](CLAUDE.md).

```sh
npm test            # components, design system, runtime, checks
npm run typecheck   # vue-tsc
npm run build       # dist/: client modules (/c/), server bundle, ds.css, index.json
```

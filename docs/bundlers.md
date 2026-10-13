# Bundler notes

## Entry resolution

`entry` wins when set. Otherwise the plugin looks at, in order:

1. vite `build.ssr` (string entries only)
2. vite `build.lib.entry`
3. vite `build.rollupOptions.input` or rollup-family `input` (string, first array element, or first record value)

When nothing resolves, the plugin errors at `buildStart` asking for `entry`.

## Scriptc binary resolution

`<root>/node_modules/.bin/scriptc` wins, so a workspace or project-local pin beats a global install. `scriptcBin` overrides both. PATH is the last fallback.

## Where the build step fits

- `runOn: "closeBundle"` (default): the bundler writes its output first, then scriptc compiles `entry`. Use this when scriptc consumes the bundled artifact or when you simply want the ELF beside `dist/`.
- `runOn: "buildStart"`: scriptc compiles before bundling. Use this when scriptc consumes sources directly and the bundle is not its input. Coverage still runs first in the same hook.

## Watch mode

Vite dev triggers `buildStart` on the initial build only; `closeBundle` does not run in `vite dev`/`rollup --watch` rebuilds. The plugin does not recompile on watch events: scriptc builds are seconds-scale and a per-save compile would make the feedback loop worse than running `scriptc run` yourself during development.

## Only vite is verified

The unplugin adapters share one implementation, but only the vite path has a tested consumer today ([ch3](https://github.com/sigilco/ch3) examples). Rollup, Webpack, esbuild, and Rolldown take the same code path for free; report adapter gaps as issues.

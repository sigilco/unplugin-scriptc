# Introduction

`@sigilco/unplugin-scriptc` runs [scriptc](https://scriptc.dev) inside your bundler pipeline through the [unplugin](https://unplugin.unjs.io) factory, so the same plugin works with Vite, Rollup, Webpack, esbuild, and Rolldown.

It does one thing: run `scriptc build` on your app entry during the build and surface `scriptc coverage` diagnostics through the bundler's warning channel. It does not analyze code itself; every reported problem comes from the compiler.

## Install

```sh
npm i -D @sigilco/unplugin-scriptc scriptc
```

`scriptc` is a peer dependency pinned to `0.3.0`. scriptc evolves fast and changes flags between releases, so the pin is deliberate; upgrade it when you are ready to re-check your build flags.

## Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { scriptcPlugin } from "@sigilco/unplugin-scriptc";

export default defineConfig({
 plugins: [
  scriptcPlugin.vite({
   entry: "src/main.ts",
   out: "dist/app",
   optimization: "speed",
  }),
 ],
});
```

## Rollup, Webpack, esbuild, Rolldown

The factory exposes the same `scriptcPlugin.<bundler>()` adapters unplugin provides:

```ts
// rollup.config.mjs
import { scriptcPlugin } from "@sigilco/unplugin-scriptc";

export default {
 plugins: [scriptcPlugin.rollup({ entry: "src/main.ts" })],
};
```

## What a build does

1. `buildStart`: `scriptc coverage <entry> --print diagnostics` runs and each blocker group is reported with its file and line. A build with blockers fails by default (`failOnBlockers`).
2. `closeBundle` (default `runOn`): `scriptc build` compiles the entry to native output at `--out` (or `.scriptc/<name>`).

`entry` can be omitted when the bundler names one: vite `build.ssr`, `build.lib.entry`, `build.rollupOptions.input`, or the rollup-family `input`.

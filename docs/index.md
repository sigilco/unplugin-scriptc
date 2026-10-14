# Introduction

`unplugin-scriptc` runs [scriptc](https://scriptc.dev) inside your bundler pipeline through the [unplugin](https://unplugin.unjs.io) factory, so the same plugin works with Vite, Rollup, Webpack, esbuild, and Rolldown.

It does one thing: run `scriptc build` on your app entry during the build and surface `scriptc coverage` diagnostics through the bundler's warning channel. It does not analyze code itself; every reported problem comes from the compiler.

## Install

::: tabs

== tab "npm"

```sh
npm i -D unplugin-scriptc scriptc
```

== tab "pnpm"

```sh
pnpm add -D unplugin-scriptc scriptc
```

== tab "bun"

```sh
bun add -D unplugin-scriptc scriptc
```

:::

`scriptc` is a peer dependency pinned to `^0.3.0`: it accepts any 0.3.x release, so patch and bug-fix releases flow through without a plugin bump, but the next minor (0.4.0) is an explicit upgrade. The plugin only relies on the `scriptc build` flag surface and the v1 diagnostics JSON envelope, both stable within the 0.3 line.

## Usage

::: tabs

== tab "Vite"

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { scriptcPlugin } from "unplugin-scriptc";

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

== tab "Rollup"

```ts
// rollup.config.mjs
import { scriptcPlugin } from "unplugin-scriptc";

export default {
 plugins: [scriptcPlugin.rollup({ entry: "src/main.ts" })],
};
```

== tab "esbuild"

```ts
// esbuild.config.mjs
import { scriptcPlugin } from "unplugin-scriptc";

export default {
 plugins: [scriptcPlugin.esbuild({ entry: "src/main.ts" })],
};
```

== tab "Webpack"

```ts
// webpack.config.mjs
import { scriptcPlugin } from "unplugin-scriptc";

export default {
 plugins: [scriptcPlugin.webpack({ entry: "src/main.ts" })],
};
```

:::

## What a build does

1. `buildStart`: `scriptc coverage <entry> --print diagnostics` runs and each blocker group is reported with its file and line. A build with blockers fails by default (`failOnBlockers`).
2. `closeBundle` (default `runOn`): `scriptc build` compiles the entry to native output at `--out` (or `.scriptc/<name>`).

`entry` can be omitted when the bundler names one: vite `build.ssr`, `build.lib.entry`, `build.rollupOptions.input`, or the rollup-family `input`.

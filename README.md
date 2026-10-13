# unplugin-scriptc

[scriptc](https://scriptc.dev) native compilation inside any bundler, via [unplugin](https://unplugin.unjs.io). Vite, Rollup, Webpack, esbuild, Rolldown.

The plugin does one thing: run `scriptc build` on your app entry as part of the bundler build, and surface `scriptc coverage` diagnostics through the bundler's warning/error channel. It does not analyze code itself. Every diagnostic it reports comes from the compiler.

## Install

```sh
npm i -D unplugin-scriptc scriptc
```

`scriptc` is a peer dependency pinned to `0.3.0` on purpose: scriptc evolves fast and breaks flags between releases. Upgrade the pin deliberately.

## Usage

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

The factory is unplugin-based, so `scriptcPlugin.rollup()`, `scriptcPlugin.webpack()`, `scriptcPlugin.esbuild()`, and `scriptcPlugin.rolldown()` work with their bundlers' plugin arrays.

On every build the plugin runs `scriptc coverage <entry> --print diagnostics` at `buildStart` and reports blocker groups with file:line sites, then runs `scriptc build` at `closeBundle` (or `buildStart` with `runOn: "buildStart"`). Output lands where `--out` says, or `.scriptc/<name>` by default.

`entry` is optional when the bundler already names an entry: vite's `build.ssr`/`build.lib.entry`/`build.rollupOptions.input`, or the rollup-family `input`, resolve it automatically.

## Options

| Option | Default | Purpose |
| --- | --- | --- |
| `entry` | bundler input | Program entry compiled by scriptc (.ts/.js) |
| `root` | vite `config.root`, else `cwd()` | Resolves entry, local bin, and process cwd |
| `scriptcBin` | `<root>/node_modules/.bin/scriptc`, else PATH | scriptc executable |
| `runOn` | `"closeBundle"` | Bundler hook the compile runs on (`"buildStart"` also allowed) |
| `diagnostics` | `"warn"` | coverage diagnostics: `"warn"`, `"error"`, or `"off"` |
| `failOnBlockers` | `true` | Fail the bundler build when coverage finds blockers |
| `out` | `.scriptc/<name><suffix>` | `-o/--out` primary output path |
| `emit` | `"exe"` | `--emit`: ir, llvm, asm, obj, exe |
| `backend` | , | `--backend` code generator |
| `optimization` | `"release"` | `--optimization`: release, dev, speed |
| `strip` | `false` | `--strip` symbol/debug payload |
| `windowsSubsystem` | `"console"` | `--windows-subsystem`: console or gui |
| `detachedExit` | `false` | `--detached-exit` Linux exit handoff |
| `keepLlvm` | `true` | `--keep-llvm`/`--no-keep-llvm` |
| `emitIr` | `false` | `--emit-ir` IR beside the output |
| `sanitize` | `false` | `--sanitize` ASan + RC audit |
| `ffi` | `[]` | `--ffi` declaration manifests (repeatable) |
| `npmStatic` | , | `--npm-static`: `"auto"` or a package list |
| `provenanceSources` | `false` | `--provenance-sources` attested-source deps |
| `externalTypes` | , | `--external-types` `{specifier: "file.d.ts"}` |
| `libProfile` | , | Library mode: `--lib --profile <p.json>` |
| `args` | `[]` | Raw passthrough appended verbatim |

Every `scriptc build` flag has a typed option. Anything a future scriptc adds before this plugin catches up goes through `args`.

## Diagnostics, not a linter

Whether a codeblock compiles is scriptc's question to answer, and only scriptc can answer it correctly: the subset changes per release, and a second implementation would drift out of sync by design. This plugin surfaces the compiler's own verdict (`coverage --print diagnostics`, the versioned JSON envelope) where the bundler already reports problems, per file and line.

A dedicated lint plugin (oxlint/ESLint rules that approximate the subset) could flag earlier in the edit loop, but it would need its own copy of the boundary and would lag the compiler. Not planned here; file an issue if you want it.

## Program code vs packages

scriptc compiles your entry's graph as program modules and eligible npm dependencies automatically. The one boundary to know: `--npm-static` is for packages the automatic eligibility check refuses; `--provenance-sources` swaps published JS for attested upstream source. Both pass straight through.

## Verification

```sh
pnpm install
pnpm test    # unit tests plus an e2e lane that builds and runs a real ELF
         # when a scriptc binary resolves (skipped otherwise)
pnpm typecheck && pnpm lint
```

## License

Apache-2.0

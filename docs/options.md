# Options

Every `scriptc build` flag of the pinned release maps to a typed option. Flags added by future scriptc releases pass through `args` until the plugin adds them.

## Plugin options

| Option | Default | Purpose |
| --- | --- | --- |
| `entry` | bundler input | Program entry compiled by scriptc (.ts/.js) |
| `root` | vite `config.root`, else `cwd()` | Resolves entry, local bin, and process cwd |
| `scriptcBin` | `<root>/node_modules/.bin/scriptc`, else PATH | scriptc executable |
| `runOn` | `"closeBundle"` | Bundler hook the compile runs on; `"buildStart"` compiles before bundling |
| `diagnostics` | `"warn"` | Coverage diagnostics mode: `"warn"`, `"error"`, `"off"` |
| `failOnBlockers` | `true` | Fail the bundler build when coverage finds blockers |

## scriptc build flags

| Option | Flag | Purpose |
| --- | --- | --- |
| `out` | `-o, --out` | Primary output path (default `.scriptc/<name><suffix>`) |
| `emit` | `--emit` | Primary output: `ir`, `llvm`, `asm`, `obj`, `exe` |
| `print` | `--print` | `native-link-info` (implies `--emit=obj`, no link) or `diagnostics` |
| `backend` | `--backend` | Code generator (`llvm`) |
| `optimization` | `--optimization` | `release` (-O2), `dev` (-O0 + breakpoints), `speed` (runtime inlining, inline RC) |
| `strip` | `--strip` | Remove symbol/debug payload |
| `windowsSubsystem` | `--windows-subsystem` | `console` or `gui` |
| `detachedExit` | `--detached-exit` | Linux helper-process exit handoff |
| `keepLlvm` | `--keep-llvm` / `--no-keep-llvm` | Keep or delete generated LLVM IR |
| `emitIr` | `--emit-ir` | Also write IR beside the output |
| `sanitize` | `--sanitize` | ASan + runtime RC audit |
| `ffi` | `--ffi` | Signature-only declaration manifests (repeatable) |
| `npmStatic` | `--npm-static` | `"auto"` or an explicit package list |
| `provenanceSources` | `--provenance-sources` | Compile deps from provenance-attested source |
| `externalTypes` | `--external-types` | `{specifier: "file.d.ts"}` embedder declarations |
| `libProfile` | `--lib --profile` | Library mode: profile entry to a static archive or Wasm reactor |
| `args` | , | Raw passthrough appended verbatim |

## Examples

Library mode:

```ts
scriptcPlugin.vite({
 libProfile: "lib.profile.json",
 out: "dist/app.a",
})
```

Wasm target passthrough (flag surface beyond the pinned set):

```ts
scriptcPlugin.vite({ entry: "src/main.ts", args: ["--target", "wasm32-wasi"] })
```

Explicit static packages plus ASan:

```ts
scriptcPlugin.vite({
 entry: "src/main.ts",
 npmStatic: ["leftpad"],
 sanitize: true,
})
```

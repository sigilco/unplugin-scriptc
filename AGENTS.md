# Agent guide

unplugin wrapper that runs `scriptc build` inside bundler pipelines and surfaces `scriptc coverage` diagnostics. Single package, published as `@sigilco/unplugin-scriptc`.

## Layout

- `src/index.ts` , the unplugin factory (`scriptcPlugin`), hook plumbing, reporter. Public API.
- `src/scriptc.ts` , the CLI interface: `ScriptcBuildOptions` flag surface, `buildArgs`/`coverageArgs` arg builders, process runner, diagnostics envelope types, bin resolution.
- `test/*.test.ts` , `node --test`. `e2e.test.ts` exercises a real scriptc binary and skips when none resolves.
- `docs/` , docmd site (see `docs/docmd.config.json`), deployed to unplugin-scriptc.pages.dev.

## Invariants

- **One responsibility.** The plugin runs the compiler. It never re-implements scriptc's analysis: diagnostics are parsed from the `--print diagnostics` JSON envelope and re-emitted, nothing is inferred locally. If a check requires knowing the compilable subset, it comes from scriptc or nowhere.
- **Every flag is reachable.** `ScriptcBuildOptions` mirrors the `scriptc build` option surface of the pinned release one-to-one; `args` is the escape hatch for newer flags. When scriptc adds flags, add the option rather than telling users to pass `args` permanently.
- **scriptc is pinned.** `peerDependencies["scriptc"]` is an exact version. Bump it deliberately with a commit that notes what changed in the flag surface or diagnostics schema (schemaVersion on the envelope is the contract).
- **Reporter contract.** `this.warn`/`this.error` exist only on some bundler hook contexts; `makeReporter` falls back to `console.warn`/`console.error` with the `[unplugin-scriptc]` prefix. Never call `this.warn` directly in a hook that lacks it.

## Commands

```sh
pnpm install   # pnpm-workspace.yaml allowBuilds lets scriptc/esbuild/docmd postinstall run
pnpm test
pnpm typecheck && pnpm lint && pnpm fmt:check
pnpm docs:dev  # docmd dev server
```

## Git

Conventional commits, no AI trailers, author Joaquin Terrasa. `main` is the release line; publish via the release workflow on tag `v*`.

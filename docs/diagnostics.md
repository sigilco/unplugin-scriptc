# Diagnostics

The plugin runs `scriptc coverage <entry> --print diagnostics` once per build and re-emits the compiler's own verdict: each diagnostic group becomes a bundler warning (or error with `diagnostics: "error"`) carrying the code, message, hint, and `file:line` site.

```
[SC1090] 'instanceof' right-hand sides other than classes declared in the program
 at src/app.ts:4:25
 this form is valid TypeScript but does not compile yet , rewrite it with a
 supported equivalent (https://scriptc.dev/limitations lists the boundary)
```

A summary line reports the static share of the entry graph:

```
unplugin-scriptc: coverage 100% static (624/624 statements)
```

`failOnBlockers` (default `true`) fails the bundler build when any error-severity group is present, since `scriptc build` would fail on the same input anyway.

## Not a linter

The compilable subset is a compiler property that changes per release. An oxlint or ESLint plugin that approximates it would drift from the real boundary and report stale answers. This plugin deliberately does not ship one; it moves the compiler's verdict into the place you already read build output. If you want an edit-time linter, that is a separate project; open an issue.

The `--print diagnostics` envelope is versioned (`schemaVersion: 1`, `compilerVersion`). The plugin parses `groups` for reporting and ignores forward-compatible fields, so a newer envelope still degrades to the summary line.

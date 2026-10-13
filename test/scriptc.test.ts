import { test } from "node:test";
import assert from "node:assert/strict";
import { buildArgs, coverageArgs, formatGroup, resolveScriptcBin } from "../src/scriptc.ts";
import type { DiagnosticGroup } from "../src/scriptc.ts";

test("buildArgs: defaults emit only the entry", () => {
  const a = buildArgs({}, "src/main.ts");
  assert.deepEqual(a, ["build", "src/main.ts"]);
});

test("buildArgs: scalar flags map one-to-one", () => {
  const a = buildArgs(
    {
      out: "dist/app",
      emit: "obj",
      backend: "llvm",
      optimization: "speed",
      strip: true,
      windowsSubsystem: "gui",
      detachedExit: true,
      keepLlvm: false,
      emitIr: true,
      sanitize: true,
      provenanceSources: true,
    },
    "src/main.ts",
  );
  assert.deepEqual(a, [
    "build",
    "src/main.ts",
    "--out",
    "dist/app",
    "--emit",
    "obj",
    "--backend",
    "llvm",
    "--optimization",
    "speed",
    "--strip",
    "--windows-subsystem",
    "gui",
    "--detached-exit",
    "--no-keep-llvm",
    "--emit-ir",
    "--sanitize",
    "--provenance-sources",
  ]);
});

test("buildArgs: keepLlvm default emits nothing, true emits --keep-llvm", () => {
  assert.ok(!buildArgs({}, "e.ts").includes("--keep-llvm"));
  assert.ok(!buildArgs({ keepLlvm: false }, "e.ts").includes("--keep-llvm"));
  assert.ok(buildArgs({ keepLlvm: true }, "e.ts").includes("--keep-llvm"));
});

test("buildArgs: repeatable flags expand in order", () => {
  const a = buildArgs(
    {
      ffi: ["a.ffi.ts", "b.ffi.ts"],
      npmStatic: ["leftpad", "rightpad"],
      externalTypes: { fs: "fs.d.ts", net: "net.d.ts" },
    },
    "e.ts",
  );
  assert.deepEqual(a.slice(2), [
    "--ffi",
    "a.ffi.ts",
    "--ffi",
    "b.ffi.ts",
    "--npm-static",
    "leftpad",
    "--npm-static",
    "rightpad",
    "--external-types",
    "fs=fs.d.ts",
    "--external-types",
    "net=net.d.ts",
  ]);
});

test("buildArgs: npmStatic 'auto' emits a single auto flag", () => {
  assert.deepEqual(buildArgs({ npmStatic: "auto" }, "e.ts"), [
    "build",
    "e.ts",
    "--npm-static",
    "auto",
  ]);
});

test("buildArgs: libProfile switches to library mode before the entry", () => {
  const a = buildArgs({ libProfile: "lib.profile.json", out: "x.a" }, "e.ts");
  assert.deepEqual(a.slice(0, 4), ["build", "--lib", "--profile", "lib.profile.json"]);
  assert.equal(a[4], "e.ts");
});

test("buildArgs: raw args passthrough appends verbatim", () => {
  const a = buildArgs({ args: ["--target", "wasm32-wasi", "--x-future"] }, "e.ts");
  assert.deepEqual(a.slice(-3), ["--target", "wasm32-wasi", "--x-future"]);
});

test("coverageArgs: entry + diagnostics envelope + external-types", () => {
  assert.deepEqual(coverageArgs("e.ts", { fs: "fs.d.ts" }), [
    "coverage",
    "e.ts",
    "--print",
    "diagnostics",
    "--external-types",
    "fs=fs.d.ts",
  ]);
});

test("resolveScriptcBin: override wins, else local .bin, else PATH", () => {
  assert.equal(resolveScriptcBin("/tmp", "/custom/scriptc"), "/custom/scriptc");
  assert.equal(resolveScriptcBin("/tmp/definitely-not-a-project"), "scriptc");
});

test("formatGroup: code, message, site, hint", () => {
  const g: DiagnosticGroup = {
    id: "SC1090-x",
    code: "SC1090",
    category: "unsupported",
    severity: "error",
    scope: "reached",
    message: "'instanceof' right-hand sides other than classes declared in the program",
    hint: "rewrite it",
    count: 1,
    primary: { file: "a.ts", line: 4, column: 25 },
    sites: [{ file: "a.ts", line: 4, column: 25 }],
  };
  const s = formatGroup(g);
  assert.match(s, /\[SC1090\]/);
  assert.match(s, /a\.ts:4:25/);
  assert.match(s, /rewrite it/);
});

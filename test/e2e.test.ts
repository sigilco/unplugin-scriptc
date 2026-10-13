// E2E: exercises the real scriptc binary end to end. Skips silently when no
// scriptc executable resolves (CI without the toolchain).

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readDiagnostics, resolveScriptcBin, runScriptc, buildArgs } from "../src/scriptc.ts";

function scriptcAvailable(root: string): boolean {
  try {
    execFileSync(resolveScriptcBin(root), ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

const root = mkdtempSync(join(tmpdir(), "unplugin-scriptc-e2e-"));
const entry = join(root, "app.ts");
writeFileSync(entry, 'console.log("hello from elf");\n');

test(
  "e2e: coverage diagnostics parse into the envelope",
  { skip: !scriptcAvailable(root) },
  async () => {
    const env = await readDiagnostics(resolveScriptcBin(root), entry, root);
    assert.notEqual(env, null);
    assert.equal(env!.schema, "scriptc-diagnostics");
    assert.equal(env!.stats.percentStatic, 100);
  },
);

test("e2e: build produces a runnable ELF", { skip: !scriptcAvailable(root) }, async () => {
  const bin = resolveScriptcBin(root);
  const out = join(root, "app-bin");
  const r = await runScriptc(bin, buildArgs({ out }, entry), root);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(existsSync(out));
  const got = execFileSync(out, { encoding: "utf8" });
  assert.equal(got.trim(), "hello from elf");
});

test(
  "e2e: blockers land in groups with file and line",
  { skip: !scriptcAvailable(root) },
  async () => {
    const bad = join(root, "bad.ts");
    writeFileSync(
      bad,
      "const p = Promise.resolve(1) as unknown;\nconsole.log(p instanceof Promise);\n",
    );
    const env = await readDiagnostics(resolveScriptcBin(root), bad, root);
    assert.notEqual(env, null);
    assert.ok(env!.groups.length > 0);
    assert.equal(env!.groups[0].code.startsWith("SC"), true);
    assert.ok(env!.groups[0].primary !== undefined);
  },
);

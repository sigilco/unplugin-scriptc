// scriptc CLI interface: option surface, process execution, and the
// versioned diagnostics envelope (`--print diagnostics`). The plugin does
// not analyze source itself; everything reported here comes from the
// compiler.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface ScriptcBuildOptions {
  // Program entry compiled by scriptc (a .ts/.js file). Required unless the
  // bundler input resolves one (vite lib/ssr entry, rollup input).
  entry?: string;
  // -o, --out: primary output path (default .scriptc/<name><suffix>).
  out?: string;
  // --emit: primary output kind (default exe). asm/obj need a platform helper.
  emit?: "ir" | "llvm" | "asm" | "obj" | "exe";
  // --backend: code generator (llvm).
  backend?: string;
  // --optimization: release (default, -O2), dev (-O0 + breakpoints + cached
  // shards), speed (runtime inlining + inline RC; larger and slower to build).
  optimization?: "release" | "dev" | "speed";
  // --strip: remove symbol/debug payload from the executable.
  strip?: boolean;
  // --windows-subsystem: console (default) or gui (no console window).
  windowsSubsystem?: "console" | "gui";
  // --detached-exit: Linux helper-process exit handoff.
  detachedExit?: boolean;
  // --keep-llvm (default true): keep generated LLVM IR beside the output.
  keepLlvm?: boolean;
  // --emit-ir: also write IR beside the output.
  emitIr?: boolean;
  // --sanitize: ASan + runtime RC audit build.
  sanitize?: boolean;
  // --ffi: signature-only declaration manifests, repeatable.
  ffi?: string[];
  // --npm-static: "auto" opts every eligible direct import in; a string list
  // names packages explicitly (each entry becomes one flag). Eligible
  // dependencies already compile automatically in v0.3.x.
  npmStatic?: "auto" | string[];
  // --provenance-sources: compile npm deps from provenance-attested source.
  provenanceSources?: boolean;
  // --external-types <specifier=file.d.ts>: embedder-provided declarations for
  // coverage analysis (repeatable).
  externalTypes?: Record<string, string>;
  // Library mode: compile the profile's entry to a linkable static archive
  // (or Wasm reactor on wasm32-wasi). Replaces the entry-point build.
  libProfile?: string;
  // Raw passthrough appended verbatim, for flags added after this plugin's
  // pinned scriptc version.
  args?: string[];
}

export function buildArgs(o: ScriptcBuildOptions, entry: string): string[] {
  const a: string[] = ["build"];
  if (o.libProfile !== undefined) {
    a.push("--lib", "--profile", o.libProfile);
  }
  a.push(entry);
  if (o.out !== undefined) a.push("--out", o.out);
  if (o.emit !== undefined) a.push("--emit", o.emit);
  if (o.backend !== undefined) a.push("--backend", o.backend);
  if (o.optimization !== undefined) a.push("--optimization", o.optimization);
  if (o.strip === true) a.push("--strip");
  if (o.windowsSubsystem !== undefined) a.push("--windows-subsystem", o.windowsSubsystem);
  if (o.detachedExit === true) a.push("--detached-exit");
  if (o.keepLlvm === true) a.push("--keep-llvm");
  if (o.keepLlvm === false) a.push("--no-keep-llvm");
  if (o.emitIr === true) a.push("--emit-ir");
  if (o.sanitize === true) a.push("--sanitize");
  for (const f of o.ffi ?? []) a.push("--ffi", f);
  if (o.npmStatic === "auto") {
    a.push("--npm-static", "auto");
  } else {
    for (const p of o.npmStatic ?? []) a.push("--npm-static", p);
  }
  if (o.provenanceSources === true) a.push("--provenance-sources");
  if (o.externalTypes !== undefined) {
    for (const spec of Object.keys(o.externalTypes)) {
      a.push("--external-types", spec + "=" + o.externalTypes[spec]);
    }
  }
  for (const x of o.args ?? []) a.push(x);
  return a;
}

export function coverageArgs(entry: string, externalTypes?: Record<string, string>): string[] {
  const a = ["coverage", entry, "--print", "diagnostics"];
  if (externalTypes !== undefined) {
    for (const spec of Object.keys(externalTypes)) {
      a.push("--external-types", spec + "=" + externalTypes[spec]);
    }
  }
  return a;
}

// scriptc-diagnostics schema v1 (`--print diagnostics` for build/coverage).
export interface DiagnosticSite {
  file: string;
  line: number;
  column: number;
}

export interface DiagnosticGroup {
  id: string;
  code: string;
  category: string;
  severity: string;
  scope: string;
  message: string;
  hint: string;
  count: number;
  primary?: DiagnosticSite;
  sites: DiagnosticSite[];
}

export interface DiagnosticsEnvelope {
  schema: string;
  schemaVersion: number;
  compilerVersion: string;
  command: string;
  entry: string;
  success: boolean;
  phase: string;
  stats: {
    statementsTotal: number;
    statementsStatic: number;
    statementsDynamic: number;
    statementsFailed: number;
    functionsSkipped: number;
    percentStatic: number;
  };
  groups: DiagnosticGroup[];
}

export function resolveScriptcBin(root: string, override?: string): string {
  if (override !== undefined) return override;
  const local = join(root, "node_modules", ".bin", "scriptc");
  if (existsSync(local)) return local;
  return "scriptc";
}

export interface ScriptcRunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function runScriptc(bin: string, args: string[], cwd: string): Promise<ScriptcRunResult> {
  return new Promise(function (resolve, reject) {
    const child = spawn(bin, args, { cwd: cwd });
    let out = "";
    let err = "";
    child.stdout.on("data", function (d: Buffer): void {
      out += d.toString();
    });
    child.stderr.on("data", function (d: Buffer): void {
      err += d.toString();
    });
    child.on("error", reject);
    child.on("close", function (code: number | null): void {
      resolve({ code: code === null ? -1 : code, stdout: out, stderr: err });
    });
  });
}

export async function readDiagnostics(
  bin: string,
  entry: string,
  cwd: string,
  externalTypes?: Record<string, string>,
): Promise<DiagnosticsEnvelope | null> {
  const r = await runScriptc(bin, coverageArgs(entry, externalTypes), cwd);
  const text = r.stdout.trim();
  if (r.code !== 0 || text.length === 0) return null;
  try {
    const env = JSON.parse(text) as DiagnosticsEnvelope;
    if (env.schema !== "scriptc-diagnostics") return null;
    return env;
  } catch {
    return null;
  }
}

export function formatGroup(g: DiagnosticGroup): string {
  const at =
    g.primary === undefined
      ? ""
      : " at " + g.primary.file + ":" + g.primary.line + ":" + g.primary.column;
  return "[" + g.code + "] " + g.message + at + "\n  " + g.hint;
}

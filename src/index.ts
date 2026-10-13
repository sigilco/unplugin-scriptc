// unplugin-scriptc -- scriptc native compilation inside any bundler
// via the unplugin framework. One responsibility: run `scriptc build` on the
// app entry with the user's flag surface, and surface `scriptc coverage`
// diagnostics through the bundler's warning/error channel.

import { createUnplugin } from "unplugin";
import { resolve } from "node:path";
import {
  buildArgs,
  formatGroup,
  readDiagnostics,
  resolveScriptcBin,
  runScriptc,
} from "./scriptc.ts";
import type { ScriptcBuildOptions } from "./scriptc.ts";

export interface ScriptcPluginOptions extends ScriptcBuildOptions {
  // Project root used to resolve relative entries, the local scriptc bin,
  // and the process cwd. Defaults to vite's config.root, else process.cwd().
  root?: string;
  // Path to the scriptc executable. Default: <root>/node_modules/.bin/scriptc
  // when present, else "scriptc" on PATH.
  scriptcBin?: string;
  // When to compile: 'closeBundle' (default) runs after the bundler finishes,
  // 'buildStart' compiles the entry before bundling (useful when scriptc
  // consumes sources rather than the bundle).
  runOn?: "buildStart" | "closeBundle";
  // `scriptc coverage` diagnostics surfaced as bundler warnings ('warn',
  // default), hard errors ('error'), or not at all ('off'). Coverage runs
  // once at buildStart regardless of runOn.
  diagnostics?: "warn" | "error" | "off";
  // Fail the bundler build when coverage reports blockers (a scriptc build
  // would fail anyway). Default true; set false to keep diagnostics
  // informational only.
  failOnBlockers?: boolean;
}

interface Reporter {
  warn(m: string): void;
  error(m: string): void;
}

// UnpluginContext.warn/error only exist on transform/load contexts. On
// buildStart/closeBundle the honest channel is console output.
function makeReporter(ctx: unknown): Reporter {
  const c = ctx as { warn?: (m: string) => void; error?: (m: string) => void };
  return {
    warn(m: string): void {
      if (typeof c.warn === "function") c.warn(m);
      else console.warn("[unplugin-scriptc] " + m);
    },
    error(m: string): void {
      if (typeof c.error === "function") c.error(m);
      else console.error("[unplugin-scriptc] ERROR: " + m);
    },
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

// Resolve the entry the same way a bundler user expects: explicit option,
// else vite's ssr/lib entry or rollup input, else nothing.
function pickEntry(opts: ScriptcPluginOptions, bundlerInput: unknown): string | undefined {
  if (opts.entry !== undefined) return opts.entry;
  if (typeof bundlerInput === "string") return bundlerInput;
  if (Array.isArray(bundlerInput) && typeof bundlerInput[0] === "string") return bundlerInput[0];
  if (isRecord(bundlerInput)) {
    const keys = Object.keys(bundlerInput);
    if (keys.length > 0 && typeof bundlerInput[keys[0]] === "string") {
      return bundlerInput[keys[0]] as string;
    }
  }
  return undefined;
}

async function diagnostics(
  rep: Reporter,
  o: ScriptcPluginOptions,
  entry: string,
  cwd: string,
): Promise<void> {
  if (o.diagnostics === "off") return;
  const mode = o.diagnostics ?? "warn";
  const bin = resolveScriptcBin(cwd, o.scriptcBin);
  const env = await readDiagnostics(bin, entry, cwd, o.externalTypes);
  if (env === null) {
    rep.warn(
      "unplugin-scriptc: could not read scriptc coverage diagnostics for " +
        entry +
        " -- is the pinned scriptc binary installed?",
    );
    return;
  }
  let blockers = 0;
  for (const g of env.groups) {
    const line = formatGroup(g);
    if (mode === "error" || g.severity === "error") {
      blockers += 1;
      rep.error(line);
    } else {
      rep.warn(line);
    }
  }
  rep.warn(
    "unplugin-scriptc: coverage " +
      env.stats.percentStatic +
      "% static (" +
      env.stats.statementsStatic +
      "/" +
      env.stats.statementsTotal +
      " statements)",
  );
  if (blockers > 0 && o.failOnBlockers !== false) {
    rep.error(
      "unplugin-scriptc: " +
        blockers +
        " scriptc blocker(s) in " +
        entry +
        " -- the compile step will fail; see https://scriptc.dev/limitations",
    );
  }
}

async function compile(
  rep: Reporter,
  o: ScriptcPluginOptions,
  entry: string,
  cwd: string,
): Promise<void> {
  const bin = resolveScriptcBin(cwd, o.scriptcBin);
  const args = buildArgs(o, entry);
  rep.warn("unplugin-scriptc: " + bin + " " + args.join(" "));
  const r = await runScriptc(bin, args, cwd);
  if (r.stdout.trim().length > 0) rep.warn(r.stdout.trim());
  if (r.code !== 0) {
    rep.error("unplugin-scriptc: scriptc build failed (exit " + r.code + ")\n" + r.stderr.trim());
    return;
  }
  if (r.stderr.trim().length > 0) rep.warn(r.stderr.trim());
}

export const scriptcPlugin = createUnplugin(function (opts: ScriptcPluginOptions | undefined) {
  const o = opts ?? {};
  let root = o.root ?? "";
  let bundlerInput: unknown;

  return {
    name: "unplugin-scriptc",

    // vite: capture config.root and the build input.
    configResolved(config: Record<string, unknown>): void {
      if (root === "" && typeof config.root === "string") root = config.root;
      const build = isRecord(config.build) ? config.build : {};
      if (typeof build.ssr === "string") bundlerInput = build.ssr;
      else if (isRecord(build.lib) && build.lib.entry !== undefined) bundlerInput = build.lib.entry;
      else if (isRecord(build.rollupOptions) && build.rollupOptions.input !== undefined) {
        bundlerInput = build.rollupOptions.input;
      }
    },

    // rollup-family adapters forward the input through options().
    options(input: unknown): unknown {
      bundlerInput = input;
      return null;
    },

    async buildStart(): Promise<void> {
      const rep = makeReporter(this);
      const cwd = root === "" ? process.cwd() : root;
      const entry = pickEntry(o, bundlerInput);
      if (entry === undefined) {
        rep.error("unplugin-scriptc: no entry resolved -- pass `entry` explicitly");
        return;
      }
      await diagnostics(rep, o, resolve(cwd, entry), cwd);
      if ((o.runOn ?? "closeBundle") === "buildStart") {
        await compile(rep, o, resolve(cwd, entry), cwd);
      }
    },

    async closeBundle(): Promise<void> {
      if ((o.runOn ?? "closeBundle") !== "closeBundle") return;
      const rep = makeReporter(this);
      const cwd = root === "" ? process.cwd() : root;
      const entry = pickEntry(o, bundlerInput);
      if (entry === undefined) {
        rep.error("unplugin-scriptc: no entry resolved -- pass `entry` explicitly");
        return;
      }
      await compile(rep, o, resolve(cwd, entry), cwd);
    },
  };
});

export { buildArgs, coverageArgs, resolveScriptcBin } from "./scriptc.ts";
export type {
  DiagnosticsEnvelope,
  DiagnosticGroup,
  DiagnosticSite,
  ScriptcBuildOptions,
} from "./scriptc.ts";

export default scriptcPlugin;

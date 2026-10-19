#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ENTRYPOINT_NAMES = new Set(["AGENTS.md", "CLAUDE.md", "Codex.md", "CODEX.md"]);
export const START_MARKER = "<!-- project-operating-standard:start -->";
export const END_MARKER = "<!-- project-operating-standard:end -->";
const IGNORED_DIRECTORIES = new Set([
  ".git", ".next", ".pnpm-store", ".turbo", ".vercel", "build", "coverage",
  "dist", "node_modules", "vendor"
]);

function isWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function asPosix(value) {
  return value.split(path.sep).join("/");
}

function canonicalRoot(root) {
  return fs.realpathSync(root);
}

export function findInstructionFiles(root) {
  const absoluteRoot = canonicalRoot(root);
  const found = [];

  function visit(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) visit(absolute);
        continue;
      }
      if (entry.isFile() && ENTRYPOINT_NAMES.has(entry.name)) {
        found.push(asPosix(path.relative(absoluteRoot, absolute)));
      }
    }
  }

  visit(absoluteRoot);
  return found;
}

export function referenceBlock(relativeEntrypoint, standardPath = "docs/agent-operating-standard.md") {
  const entryDirectory = path.posix.dirname(asPosix(relativeEntrypoint));
  const link = path.posix.relative(entryDirectory === "." ? "" : entryDirectory, asPosix(standardPath)) || path.posix.basename(standardPath);
  return [
    START_MARKER,
    `Follow [the shared agent operating standard](${link}). It supplements this project's rules and does not override project-specific instructions.`,
    END_MARKER
  ].join("\n");
}

function inspectEntry(root, relativeEntrypoint, standardPath) {
  const realRoot = canonicalRoot(root);
  const file = path.resolve(realRoot, relativeEntrypoint);
  const realFile = fs.realpathSync(file);
  if (!isWithin(realRoot, realFile)) throw new Error(`entrypoint_outside_root:${relativeEntrypoint}`);
  if (!ENTRYPOINT_NAMES.has(path.basename(relativeEntrypoint))) throw new Error(`unsupported_entrypoint:${relativeEntrypoint}`);
  if (!fs.statSync(realFile).isFile()) throw new Error(`entrypoint_not_file:${relativeEntrypoint}`);
  const contents = fs.readFileSync(realFile, "utf8");
  const expectedBlock = referenceBlock(relativeEntrypoint, standardPath);
  const startCount = contents.split(START_MARKER).length - 1;
  const endCount = contents.split(END_MARKER).length - 1;

  if (startCount === 0 && endCount === 0) {
    if (contents.includes(standardPath)) return { path: asPosix(relativeEntrypoint), state: "unmanaged-reference" };
    return { path: asPosix(relativeEntrypoint), state: "missing" };
  }
  if (startCount !== 1 || endCount !== 1) return { path: asPosix(relativeEntrypoint), state: "malformed-block" };

  const start = contents.indexOf(START_MARKER);
  const end = contents.indexOf(END_MARKER) + END_MARKER.length;
  const actualBlock = contents.slice(start, end);
  if (actualBlock !== expectedBlock) return { path: asPosix(relativeEntrypoint), state: "drift" };
  return { path: asPosix(relativeEntrypoint), state: "linked" };
}

function ensureStandard(root, standardPath) {
  const realRoot = canonicalRoot(root);
  const file = path.resolve(realRoot, standardPath);
  let realFile;
  try {
    realFile = fs.realpathSync(file);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`standard_not_found:${standardPath}`);
    }
    throw error;
  }
  if (!isWithin(realRoot, realFile)) throw new Error(`standard_outside_root:${standardPath}`);
  if (!fs.statSync(realFile).isFile()) {
    throw new Error(`standard_not_found:${standardPath}`);
  }
}

export function createPlan(root, standardPath = "docs/agent-operating-standard.md") {
  ensureStandard(root, standardPath);
  const candidates = findInstructionFiles(root).map((entrypoint) => inspectEntry(root, entrypoint, standardPath));
  return {
    mode: "dry-run",
    candidates,
    proposedActions: candidates
      .filter(({ state }) => state === "missing")
      .map(({ path: entrypoint }) => ({
        entrypoint,
        action: "review whether this candidate is an active entry point before applying the standard"
      })),
    requiresManualReview: candidates
      .filter(({ state }) => ["drift", "malformed-block", "unmanaged-reference"].includes(state))
      .map(({ path: entrypoint, state }) => ({ entrypoint, state }))
  };
}

export function applyReferences(root, entrypoints, standardPath = "docs/agent-operating-standard.md") {
  ensureStandard(root, standardPath);
  if (entrypoints.length === 0) throw new Error("explicit_entrypoints_required");
  const selected = [...new Set(entrypoints)];
  const preflight = selected.map((entrypoint) => inspectEntry(root, entrypoint, standardPath));
  const invalid = preflight.find(({ state }) => !["linked", "missing"].includes(state));
  if (invalid) throw new Error(`manual_review_required:${invalid.path}:${invalid.state}`);

  const realRoot = canonicalRoot(root);
  const pendingWrites = preflight
    .filter(({ state }) => state === "missing")
    .map(({ path: entrypoint }) => {
      const file = path.resolve(realRoot, entrypoint);
      const original = fs.readFileSync(file, "utf8");
      return { path: entrypoint, file, original };
    });

  for (const { path: entrypoint, file, original } of pendingWrites) {
    const separator = original.length === 0 || original.endsWith("\n") ? "" : "\n";
    fs.writeFileSync(file, `${original}${separator}\n${referenceBlock(entrypoint, standardPath)}\n`);
  }

  return preflight.map(({ path: entrypoint, state }) => ({
    path: entrypoint,
    result: state === "linked" ? "already-linked" : "linked"
  }));
}

export function checkReferences(root, entrypoints, standardPath = "docs/agent-operating-standard.md") {
  ensureStandard(root, standardPath);
  if (entrypoints.length === 0) throw new Error("explicit_entrypoints_required");
  const results = entrypoints.map((entrypoint) => inspectEntry(root, entrypoint, standardPath));
  const failed = results.filter(({ state }) => state !== "linked");
  return { ok: failed.length === 0, results };
}

function usage() {
  return [
    "Usage:",
    "  node scripts/project-guidance.mjs plan --root <project-root>",
    "  node scripts/project-guidance.mjs apply --root <project-root> --entrypoint <path> [--entrypoint <path> ...]",
    "  node scripts/project-guidance.mjs check --root <project-root> --entrypoint <path> [--entrypoint <path> ...]",
    "",
    "Apply and check require explicit existing instruction files. The default standard path is docs/agent-operating-standard.md."
  ].join("\n");
}

function parseArgs(args) {
  const [command, ...options] = args;
  const parsed = { command, root: process.cwd(), standard: "docs/agent-operating-standard.md", entrypoints: [] };
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    if (option === "--root" && options[index + 1]) parsed.root = options[++index];
    else if (option === "--standard" && options[index + 1]) parsed.standard = options[++index];
    else if (option === "--entrypoint" && options[index + 1]) parsed.entrypoints.push(options[++index]);
    else throw new Error(`unknown_or_incomplete_option:${option}`);
  }
  if (!["plan", "apply", "check"].includes(parsed.command)) throw new Error(usage());
  return parsed;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.command === "plan") {
      process.stdout.write(`${JSON.stringify(createPlan(options.root, options.standard), null, 2)}\n`);
    } else if (options.command === "apply") {
      process.stdout.write(`${JSON.stringify({ results: applyReferences(options.root, options.entrypoints, options.standard) }, null, 2)}\n`);
    } else {
      const result = checkReferences(options.root, options.entrypoints, options.standard);
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      if (!result.ok) process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

const scriptPath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();

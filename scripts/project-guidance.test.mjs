import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  applyReferences,
  checkReferences,
  createPlan,
  findInstructionFiles,
  referenceBlock
} from "./project-guidance.mjs";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "project-guidance-"));
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs/agent-operating-standard.md"), "# Standard\n");
  return root;
}

test("plan discovers candidates without editing them and skips generated directories", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Existing project rules\nKeep this exact wording.\n");
  fs.mkdirSync(path.join(root, "packages/service"), { recursive: true });
  fs.writeFileSync(path.join(root, "packages/service/CLAUDE.md"), "# Service instructions\n");
  fs.mkdirSync(path.join(root, "node_modules/ignored"), { recursive: true });
  fs.writeFileSync(path.join(root, "node_modules/ignored/AGENTS.md"), "# Not a project entry point\n");

  const before = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  const plan = createPlan(root);

  assert.deepEqual(findInstructionFiles(root), ["AGENTS.md", "packages/service/CLAUDE.md"]);
  assert.deepEqual(plan.proposedActions.map(({ entrypoint }) => entrypoint), ["AGENTS.md", "packages/service/CLAUDE.md"]);
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), before);
});

test("apply is idempotent and preserves existing project instructions", () => {
  const root = fixture();
  const original = "# Project-specific rules\nKeep existing content and ordering.\n";
  fs.writeFileSync(path.join(root, "AGENTS.md"), original);

  assert.deepEqual(applyReferences(root, ["AGENTS.md"]), [{ path: "AGENTS.md", result: "linked" }]);
  const once = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");
  assert.ok(once.startsWith(original));
  assert.equal(once.split("project-operating-standard:start").length - 1, 1);
  assert.deepEqual(applyReferences(root, ["AGENTS.md"]), [{ path: "AGENTS.md", result: "already-linked" }]);
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), once);
  assert.deepEqual(checkReferences(root, ["AGENTS.md"]), {
    ok: true,
    results: [{ path: "AGENTS.md", state: "linked" }]
  });
});

test("nested entry points get correct relative links and explicit selection controls writes", () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, "apps/site"), { recursive: true });
  fs.writeFileSync(path.join(root, "apps/site/Codex.md"), "# Site rules\n");
  fs.writeFileSync(path.join(root, "CLAUDE.md"), "# Canonical Claude instructions\n");

  applyReferences(root, ["apps/site/Codex.md"]);
  const nested = fs.readFileSync(path.join(root, "apps/site/Codex.md"), "utf8");
  assert.ok(nested.includes("(../../docs/agent-operating-standard.md)"));
  assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), "# Canonical Claude instructions\n");
  assert.equal(referenceBlock("AGENTS.md").includes("(docs/agent-operating-standard.md)"), true);
});

test("apply refuses malformed or unmanaged references instead of overwriting them", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Rules\n[standard](docs/agent-operating-standard.md)\n");
  assert.throws(() => applyReferences(root, ["AGENTS.md"]), /manual_review_required:AGENTS\.md:unmanaged-reference/);
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), "# Rules\n[standard](docs/agent-operating-standard.md)\n");
});

test("apply preflights every selected entry point before writing any file", () => {
  const root = fixture();
  const originalAgents = "# Existing project rules\nKeep these unchanged if a later target fails.\n";
  const originalClaude = "# Existing Claude rules\n[standard](docs/agent-operating-standard.md)\n";
  fs.writeFileSync(path.join(root, "AGENTS.md"), originalAgents);
  fs.writeFileSync(path.join(root, "CLAUDE.md"), originalClaude);

  assert.throws(
    () => applyReferences(root, ["AGENTS.md", "CLAUDE.md"]),
    /manual_review_required:CLAUDE\.md:unmanaged-reference/
  );
  assert.equal(fs.readFileSync(path.join(root, "AGENTS.md"), "utf8"), originalAgents);
  assert.equal(fs.readFileSync(path.join(root, "CLAUDE.md"), "utf8"), originalClaude);
});

test("standard symlinks cannot escape the project root", () => {
  const root = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "project-guidance-outside-"));
  const outsideStandard = path.join(outside, "standard.md");
  fs.writeFileSync(outsideStandard, "# External standard\n");
  fs.unlinkSync(path.join(root, "docs/agent-operating-standard.md"));
  fs.symlinkSync(outsideStandard, path.join(root, "docs/agent-operating-standard.md"));

  assert.throws(() => createPlan(root), /standard_outside_root:docs\/agent-operating-standard\.md/);
});

test("a symlinked project root is accepted when its standard remains inside the real root", () => {
  const realRoot = fixture();
  fs.writeFileSync(path.join(realRoot, "AGENTS.md"), "# Existing project rules\n");
  const linkParent = fs.mkdtempSync(path.join(os.tmpdir(), "project-guidance-root-link-"));
  const linkedRoot = path.join(linkParent, "project");
  fs.symlinkSync(realRoot, linkedRoot, "dir");

  assert.equal(createPlan(linkedRoot).candidates[0].path, "AGENTS.md");
  assert.deepEqual(applyReferences(linkedRoot, ["AGENTS.md"]), [{ path: "AGENTS.md", result: "linked" }]);
  assert.equal(checkReferences(linkedRoot, ["AGENTS.md"]).ok, true);
});

test("check requires explicit entry points and reports drift", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "AGENTS.md"), "# Rules\n");
  assert.throws(() => checkReferences(root, []), /explicit_entrypoints_required/);
  applyReferences(root, ["AGENTS.md"]);
  const file = path.join(root, "AGENTS.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("supplements this project's rules", "overrides this project's rules"));
  assert.equal(checkReferences(root, ["AGENTS.md"]).ok, false);
});

test("project guidance rollout manifest records all coverage states without repository names", () => {
  const manifest = JSON.parse(fs.readFileSync(new URL("../docs/project-guidance-rollout.json", import.meta.url), "utf8"));
  assert.deepEqual([...new Set(manifest.targets.map(({ status }) => status))].sort(), ["blocked", "covered", "unknown"]);
  assert.deepEqual(manifest.targets[0].verifiedEntryPoints, ["AGENTS.md"]);
  assert.ok(manifest.targets.every(({ scope }) => !/private-project|client-[a-z0-9]+/i.test(scope)));
});

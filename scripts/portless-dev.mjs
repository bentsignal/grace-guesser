import { spawn, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";

const APP_NAME = "grace-guesser";
const MAIN_APP_NAME = `www.${APP_NAME}`;
const DEFAULT_BRANCHES = new Set(["main", "master"]);

function git(args) {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });

  return result.status === 0 ? result.stdout.trim() : "";
}

function currentWorktreePath() {
  const root = git(["rev-parse", "--show-toplevel"]);

  return root ? realpathSync(root) : process.cwd();
}

function primaryWorktreePath() {
  const output = git(["worktree", "list", "--porcelain"]);
  const match = output.match(/^worktree (.+)$/m);

  return match ? realpathSync(match[1]) : currentWorktreePath();
}

function sanitizeLabel(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
}

function worktreeId(worktreePath) {
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const branchName = branch.split("/").at(-1);
  const branchId =
    branchName && branchName !== "HEAD" && !DEFAULT_BRANCHES.has(branchName)
      ? sanitizeLabel(branchName)
      : "";

  if (branchId) return branchId;

  const repoName = path.basename(worktreePath);
  const parentName = path.basename(path.dirname(worktreePath));
  const fallback =
    parentName && parentName !== repoName ? parentName : repoName;

  return sanitizeLabel(fallback);
}

const currentPath = currentWorktreePath();
const appName =
  currentPath === primaryWorktreePath()
    ? MAIN_APP_NAME
    : `${worktreeId(currentPath)}.${APP_NAME}`;

const child = spawn("portless", [appName, "vite", "dev"], { stdio: "inherit" });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

import { spawn, spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";

const APP_NAME = "elden-ring-map-tap";
const MAIN_APP_NAME = `www.${APP_NAME}`;

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

const appName =
  currentWorktreePath() === primaryWorktreePath() ? MAIN_APP_NAME : APP_NAME;

const child = spawn(
  "portless",
  ["run", "--name", appName, "vite", "dev"],
  { stdio: "inherit" },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

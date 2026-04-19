import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const latestDir = path.join(root, "runs", "latest");
const latestScoreFile = path.join(latestDir, "score.json");

fs.mkdirSync(latestDir, { recursive: true });

function resolveCommand(cmd) {
  if (process.platform !== "win32") return cmd;
  const needsCmd = new Set(["npm", "npx", "pnpm", "yarn", "opencode"]);
  return needsCmd.has(cmd) ? `${cmd}.cmd` : cmd;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(resolveCommand(command), args, {
      cwd: options.cwd || root,
      env: { ...process.env, ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });

    child.on("error", (error) => {
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${String(error)}`.trim() });
    });

    child.on("close", (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

async function main() {
  const baseline = fs.existsSync(latestScoreFile)
    ? JSON.parse(fs.readFileSync(latestScoreFile, "utf8"))
    : null;

  await runCommand(process.execPath, [path.join("scripts", "evaluate.js")], {
    env: { OPENCODE_SELF_IMPROVE_CHILD: "1" }
  });

  const refreshed = fs.existsSync(latestScoreFile)
    ? JSON.parse(fs.readFileSync(latestScoreFile, "utf8"))
    : null;

  const baselineScore = baseline?.totals?.score ?? null;
  const currentScore = refreshed?.totals?.score ?? null;

  const prompt = [
    "Use the self-improve skill.",
    "Inspect AGENTS.md, eval/config.json, scripts/, and runs/latest/score.json.",
    "Make exactly one focused improvement to increase correctness and verification quality.",
    "Prefer concise final answers when correctness is unchanged or better.",
    "Do not change the underlying model.",
    `Baseline score: ${baselineScore === null ? "none" : baselineScore}.`,
    `Current score: ${currentScore === null ? "none" : currentScore}.`,
    "After editing, re-run the local evaluation and write runs/latest/proposal.md."
  ].join(" ");

  const result = await runCommand("opencode", ["run", prompt], {
    env: { OPENCODE_SELF_IMPROVE_CHILD: "1" }
  });

  const logPath = path.join(latestDir, "evolve-output.txt");
  fs.writeFileSync(logPath, [result.stdout, result.stderr].filter(Boolean).join("\n\n"));

  if (!result.ok) {
    process.exit(result.code || 1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(message + "\n");
  process.exit(1);
});

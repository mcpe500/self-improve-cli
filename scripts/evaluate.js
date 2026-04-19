import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const evalDir = path.join(root, "eval");
const runsDir = path.join(root, "runs");
const latestDir = path.join(runsDir, "latest");
const historyDir = path.join(runsDir, "history");

fs.mkdirSync(latestDir, { recursive: true });
fs.mkdirSync(historyDir, { recursive: true });

const config = JSON.parse(fs.readFileSync(path.join(evalDir, "config.json"), "utf8"));

function nowIso() {
  return new Date().toISOString();
}

function dayKey() {
  return nowIso().slice(0, 10);
}

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
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      resolve({ ok: false, code: null, stdout, stderr: `${stderr}\n${String(error)}`.trim() });
    });

    child.on("close", (code) => {
      resolve({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function scoreReplayOutput(text, replay) {
  const lower = text.toLowerCase();
  const mustContain = Array.isArray(replay.mustContain) ? replay.mustContain : [];
  const containsAll = mustContain.every((item) => lower.includes(String(item).toLowerCase()));
  return { passed: containsAll, length: text.length };
}

async function runTests() {
  const results = [];
  for (const entry of config.tests || []) {
    if (!Array.isArray(entry) || entry.length === 0) continue;
    const [command, ...args] = entry;
    const result = await runCommand(command, args);
    results.push({ command: [command, ...args], ...result });
  }
  return results;
}

async function runReplays() {
  const results = [];
  for (const replay of config.replays || []) {
    const result = await runCommand("opencode", ["run", replay.prompt], {
      env: { OPENCODE_SELF_IMPROVE_CHILD: "1" }
    });
    const replayScore = scoreReplayOutput(result.stdout || "", replay);
    results.push({
      name: replay.name,
      prompt: replay.prompt,
      mustContain: replay.mustContain || [],
      ...result,
      passed: result.ok && replayScore.passed,
      outputLength: replayScore.length
    });
  }
  return results;
}

function summarize(tests, replays) {
  const weights = config.scoreWeights || {};
  const conciseThreshold = Number(config.conciseThresholdChars || 1800);
  const longThreshold = Number(config.longOutputThresholdChars || 4000);

  const testPasses = tests.filter((x) => x.ok).length;
  const replayPasses = replays.filter((x) => x.passed).length;
  const conciseCount = replays.filter((x) => x.outputLength <= conciseThreshold).length;
  const longCount = replays.filter((x) => x.outputLength > longThreshold).length;

  const score =
    testPasses * Number(weights.testPass || 0) +
    replayPasses * Number(weights.replayPass || 0) +
    conciseCount * Number(weights.conciseBonus || 0) -
    longCount * Number(weights.longOutputPenalty || 0);

  return {
    createdAt: nowIso(),
    day: dayKey(),
    tests,
    replays,
    totals: {
      testsRun: tests.length,
      testPasses,
      replaysRun: replays.length,
      replayPasses,
      conciseCount,
      longCount,
      score
    }
  };
}

async function main() {
  const tests = await runTests();
  const replays = await runReplays();
  const summary = summarize(tests, replays);

  const stamp = summary.createdAt.replace(/[:.]/g, "-");
  const historyFile = path.join(historyDir, `${stamp}.json`);
  const latestFile = path.join(latestDir, "score.json");

  fs.writeFileSync(historyFile, JSON.stringify(summary, null, 2));
  fs.writeFileSync(latestFile, JSON.stringify(summary, null, 2));

  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(message + "\n");
  process.exit(1);
});

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const stateFileName = ".auto-evolve-state.json";

function resolveCommand(cmd) {
  if (process.platform !== "win32") return cmd;
  const needsCmd = new Set(["npm", "npx", "pnpm", "yarn", "opencode"]);
  return needsCmd.has(cmd) ? `${cmd}.cmd` : cmd;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(resolveCommand(command), args, {
      cwd: options.cwd,
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

function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function startOfDayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const AutoEvolvePlugin = async ({ client, directory }) => {
  const root = directory;
  const configFile = path.join(root, "eval", "config.json");
  const stateFile = path.join(root, "runs", stateFileName);

  fs.mkdirSync(path.join(root, "runs"), { recursive: true });

  return {
    event: async ({ event }) => {
      if (process.env.OPENCODE_SELF_IMPROVE_CHILD === "1") return;
      if (event.type !== "session.idle") return;
      if (!fs.existsSync(configFile)) return;

      const config = readJsonSafe(configFile, {});
      if (!config.automaticOnIdle) return;

      const cooldownMs = Number(config.idleCooldownSeconds || 1800) * 1000;
      const maxAutoRunsPerDay = Number(config.maxAutoRunsPerDay || 3);
      const now = Date.now();
      const state = readJsonSafe(stateFile, { lastRunAt: 0, dayStartMs: startOfDayMs(), runsToday: 0 });

      if (state.dayStartMs !== startOfDayMs()) {
        state.dayStartMs = startOfDayMs();
        state.runsToday = 0;
      }

      if (now - Number(state.lastRunAt || 0) < cooldownMs) return;
      if (Number(state.runsToday || 0) >= maxAutoRunsPerDay) return;

      state.lastRunAt = now;
      state.runsToday = Number(state.runsToday || 0) + 1;
      fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

      await client.app.log({
        body: {
          service: "auto-evolve",
          level: "info",
          message: "Starting idle self-improvement run"
        }
      });

      const result = await runCommand(process.execPath, [path.join("scripts", "evolve.js")], {
        cwd: root,
        env: { OPENCODE_SELF_IMPROVE_CHILD: "1" }
      });

      await client.app.log({
        body: {
          service: "auto-evolve",
          level: result.ok ? "info" : "error",
          message: result.ok ? "Idle self-improvement run finished" : "Idle self-improvement run failed",
          extra: { code: result.code }
        }
      });
    }
  };
};

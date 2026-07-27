import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const viteCommand = isWindows ? "node_modules\\.bin\\vite.cmd" : "node_modules/.bin/vite";

const apiProcess = spawn(process.execPath, ["server/dev-server.mjs"], {
  stdio: "inherit",
});

const uiProcess = spawn(viteCommand, [], {
  stdio: "inherit",
  shell: isWindows,
});

function shutdown(exitCode) {
  if (!apiProcess.killed) {
    apiProcess.kill();
  }

  if (!uiProcess.killed) {
    uiProcess.kill();
  }

  process.exit(exitCode);
}

apiProcess.on("exit", (code) => shutdown(code || 0));
uiProcess.on("exit", (code) => shutdown(code || 0));

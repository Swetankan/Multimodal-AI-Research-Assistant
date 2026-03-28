const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");
const path = require("path");

const root = path.resolve(__dirname, "..");
const backendDir = path.join(root, "backend");
const frontendDir = path.join(root, "frontend");
const backendPython = path.join(backendDir, ".venv", "Scripts", "python.exe");
const frontendPortCandidates = [3000, 3001, 3002, 3010];
const backendPortCandidates = [8000, 8001, 8002, 8010];

function fail(message) {
  console.error(`\n[dev] ${message}\n`);
  process.exit(1);
}

function canListen(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

async function pickPort(candidates, label) {
  for (const port of candidates) {
    if (await canListen(port)) {
      return port;
    }
  }

  fail(`No free ${label} port found in [${candidates.join(", ")}]. Stop old dev servers first.`);
}

if (!fs.existsSync(backendPython)) {
  fail("Backend virtual environment not found at backend\\.venv\\Scripts\\python.exe. Create it first, then run npm run dev again.");
}

if (!fs.existsSync(path.join(frontendDir, "package.json"))) {
  fail("Frontend package.json not found.");
}

const processes = [];
let shuttingDown = false;

function spawnManaged({ name, command, args, cwd, env = process.env, shell = false }) {
  let child;

  try {
    child = spawn(command, args, {
      cwd,
      env,
      shell,
      stdio: ["inherit", "pipe", "pipe"],
    });
  } catch (error) {
    fail(`${name} failed to start: ${error.message}`);
  }

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on("error", (error) => {
    if (shuttingDown) {
      return;
    }

    console.error(`\n[dev] ${name} failed to start: ${error.message}\n`);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`\n[dev] ${name} exited with ${detail}. Stopping the other process.\n`);
    shutdown(code ?? 1);
  });

  processes.push(child);
  return child;
}

function terminateChild(child) {
  if (!child || child.killed) {
    return;
  }

  if (process.platform === "win32") {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
    return;
  }

  child.kill("SIGINT");
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of processes) {
    terminateChild(child);
  }

  setTimeout(() => process.exit(exitCode), 500);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

async function main() {
  const backendPort = await pickPort(backendPortCandidates, "backend");
  const frontendPort = await pickPort(frontendPortCandidates, "frontend");
  const apiBaseUrl = `http://localhost:${backendPort}`;

  console.log(`[dev] Starting backend on http://localhost:${backendPort}`);
  console.log(`[dev] Starting frontend on http://localhost:${frontendPort}`);

  spawnManaged({
    name: "backend",
    command: backendPython,
    args: ["-m", "uvicorn", "main:app", "--reload", "--host", "0.0.0.0", "--port", String(backendPort)],
    cwd: backendDir,
  });

  const frontendEnv = {
    ...process.env,
    NEXT_PUBLIC_API_BASE_URL: apiBaseUrl,
    PORT: String(frontendPort),
  };

  if (process.platform === "win32") {
    spawnManaged({
      name: "frontend",
      command: "cmd.exe",
      args: ["/d", "/s", "/c", `npm run dev -- --hostname 0.0.0.0 --port ${frontendPort}`],
      cwd: frontendDir,
      env: frontendEnv,
    });
  } else {
    spawnManaged({
      name: "frontend",
      command: "npm",
      args: ["run", "dev", "--", "--hostname", "0.0.0.0", "--port", String(frontendPort)],
      cwd: frontendDir,
      env: frontendEnv,
    });
  }
}

main().catch((error) => {
  fail(`Startup check failed: ${error.message}`);
});
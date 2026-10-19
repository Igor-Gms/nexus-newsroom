import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendDir = path.join(rootDir, "backend");
const viteEntry = path.join(rootDir, "node_modules", "vite", "bin", "vite.js");

function envFileValue(filePath, key) {
  try {
    const line = readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith(`${key}=`));
    if (!line) return undefined;
    return line.slice(key.length + 1).trim().replace(/^(['"])(.*)\\1$/, "$2");
  } catch {
    return undefined;
  }
}

const backendHost = process.env.HOST ?? envFileValue(path.join(backendDir, ".env"), "HOST") ?? "127.0.0.1";
const backendPort = process.env.PORT ?? envFileValue(path.join(backendDir, ".env"), "PORT") ?? "3000";
const healthHost = ["0.0.0.0", "::"].includes(backendHost) ? "127.0.0.1" : backendHost;
const healthUrl = `http://${healthHost}:${backendPort}/api/health`;
const children = [];
let shuttingDown = false;

function startChild(label, command, args, cwd) {
  const child = spawn(command, args, { cwd, env: process.env, stdio: "inherit" });
  let resolveClosed;
  const closed = new Promise((resolve) => {
    resolveClosed = resolve;
  });
  children.push({ child, closed });

  child.once("close", resolveClosed);
  child.once("error", (error) => {
    console.error(`Não foi possível iniciar ${label}: ${error.message}`);
    shutdown(1);
  });
  child.once("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(`${label} encerrou (${signal ?? code ?? "sem código"}).`);
      shutdown(code ?? 1);
    }
  });
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const active = children.filter(({ child }) => child.exitCode === null);
  for (const { child } of active) child.kill("SIGTERM");

  const forceExit = setTimeout(() => process.exit(code), 5000);
  forceExit.unref();
  Promise.all(active.map(({ closed }) => closed)).then(() => {
    clearTimeout(forceExit);
    process.exit(code);
  });
}

async function apiIsReady() {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForApi(apiProcess) {
  const deadline = Date.now() + 10 * 60 * 1000;
  while (!shuttingDown && Date.now() < deadline) {
    if (apiProcess.exitCode !== null) return false;
    if (await apiIsReady()) return true;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

try {
  if (!(await apiIsReady())) {
    console.log(`Iniciando API Rust e aguardando ${healthUrl}...`);
    const apiProcess = startChild("API Rust", "cargo", ["run"], backendDir);
    if (!(await waitForApi(apiProcess))) {
      throw new Error("A API não ficou pronta. Confira os logs do backend e tente novamente.");
    }
  } else {
    console.log(`API Rust já está respondendo em ${healthUrl}.`);
  }

  if (!shuttingDown) {
    console.log("API pronta. Iniciando a interface web...");
    startChild("Interface web", process.execPath, [viteEntry, "dev"], rootDir);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  shutdown(1);
}

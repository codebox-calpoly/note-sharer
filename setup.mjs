import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const skipSupabase = args.has("--skip-supabase");
const skipEnv = args.has("--skip-env");
const noStart = args.has("--no-start");
const debug = args.has("--debug");

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cwdRoot = process.cwd();
const rootDir = fs.existsSync(path.join(cwdRoot, "frontend")) ? cwdRoot : scriptRoot;
const frontendDir = path.join(rootDir, "frontend");
const envPath = path.join(frontendDir, ".env.local");
const requiredEnvKeys = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: true,
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const openBrowser = (url) => {
  const platform = process.platform;
  let command = null;
  let args = [];

  if (platform === "win32") {
    command = "cmd";
    args = ["/c", "start", "", url];
  } else if (platform === "darwin") {
    command = "open";
    args = [url];
  } else {
    command = "xdg-open";
    args = [url];
  }

  const result = spawnSync(command, args, { stdio: "ignore", shell: true });
  if (result.status !== 0) {
    console.warn(`Unable to auto-open browser. Visit ${url} manually.`);
  }
};

const checkNodeVersion = () => {
  const [major, minor] = process.versions.node.split(".").map((part) => Number(part));
  const supported = major > 20 || (major === 20 && minor >= 9);
  if (!supported) {
    fail(
      "Node.js 20.9+ is required. Install it from https://nodejs.org/ or use nvm.",
    );
  }
  console.log(`Node.js ${process.versions.node} detected.`);
};

const checkSupabaseCli = () => {
  const result = spawnSync("supabase", ["--version"], {
    shell: true,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    console.error("Supabase CLI not found.");
    console.error("Install it with:");
    console.error("  macOS: brew install supabase/tap/supabase");
    console.error("  Windows (PowerShell):");
    console.error("    Set-ExecutionPolicy -Scope CurrentUser RemoteSigned");
    console.error("    iwr -useb get.scoop.sh | iex");
    console.error("    scoop install supabase");
    process.exit(1);
  }
};

const checkEnvFile = () => {
  if (debug) {
    console.log(`CWD: ${cwdRoot}`);
    console.log(`Root: ${rootDir}`);
    console.log(`Env path: ${envPath}`);
  }
  if (!fs.existsSync(envPath)) {
    console.error(`Missing env file at: ${envPath}`);
    fail("Missing frontend/.env.local. See README for required keys.");
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const presentKeys = new Set();

  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z0-9_]+)\s*=/);
    if (match) {
      presentKeys.add(match[1]);
    }
  });

  const missing = requiredEnvKeys.filter((key) => !presentKeys.has(key));
  if (missing.length > 0) {
    console.error("Missing required env keys in frontend/.env.local:");
    missing.forEach((key) => console.error(`  - ${key}`));
    process.exit(1);
  }
};

checkNodeVersion();

if (!skipSupabase) {
  checkSupabaseCli();
}

if (!skipEnv) {
  checkEnvFile();
}

run("npm", ["install"], { cwd: frontendDir });

if (!noStart) {
  const devServer = spawn("npm", ["run", "dev"], {
    cwd: frontendDir,
    stdio: "inherit",
    shell: true,
  });

  setTimeout(() => {
    openBrowser("http://localhost:3000");
  }, 1500);

  devServer.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

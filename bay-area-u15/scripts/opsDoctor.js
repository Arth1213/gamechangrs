#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { loadEnvFile } = require("../apps/api/src/lib/env");

const workspaceRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(workspaceRoot, ".env"));
const { closePool, testConnection } = require("../apps/api/src/lib/connection");

function addCheck(checks, name, status, details) {
  checks.push({ name, status, details });
}

async function main() {
  const checks = [];

  const envPath = path.join(workspaceRoot, ".env");
  const leagueConfigPath = path.join(workspaceRoot, "config", "leagues.yaml");
  const weightsConfigPath = path.join(workspaceRoot, "config", "weights.yaml");

  addCheck(
    checks,
    ".env file",
    fs.existsSync(envPath) ? "ok" : "warning",
    fs.existsSync(envPath) ? envPath : "Create bay-area-u15/.env before running local ops."
  );
  addCheck(
    checks,
    "league config",
    fs.existsSync(leagueConfigPath) ? "ok" : "error",
    leagueConfigPath
  );
  addCheck(
    checks,
    "weights config",
    fs.existsSync(weightsConfigPath) ? "ok" : "error",
    weightsConfigPath
  );

  if (process.env.DATABASE_URL) {
    try {
      const db = await testConnection();
      addCheck(
        checks,
        "database connection",
        "ok",
        `${db.database_name} as ${db.current_user} @ ${db.server_time}`
      );
    } catch (error) {
      addCheck(checks, "database connection", "error", error.message);
    }
  } else {
    addCheck(
      checks,
      "database connection",
      "warning",
      "DATABASE_URL is not set in bay-area-u15/.env."
    );
  }

  try {
    const executablePath = chromium.executablePath();
    addCheck(checks, "playwright chromium", executablePath ? "ok" : "warning", executablePath || "No executable path resolved.");
  } catch (error) {
    addCheck(checks, "playwright chromium", "error", error.message);
  }

  const hasError = checks.some((check) => check.status === "error");
  const result = {
    generatedAt: new Date().toISOString(),
    workspaceRoot,
    status: hasError ? "error" : "ok",
    checks,
  };

  console.log(JSON.stringify(result, null, 2));
  process.exitCode = hasError ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });

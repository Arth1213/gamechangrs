const path = require("path");
const { Pool } = require("pg");
const { loadEnvFile } = require("../../../api/src/lib/env");

loadEnvFile(path.resolve(process.cwd(), ".env"));

let sharedPool = null;

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error("DATABASE_URL is not set for the worker runtime.");
  }
  return value;
}

function getSslConfig() {
  const sslMode = String(process.env.DATABASE_SSL_MODE || "disable").toLowerCase();

  if (sslMode === "require") {
    return { rejectUnauthorized: false };
  }

  if (sslMode === "verify-full") {
    return { rejectUnauthorized: true };
  }

  return undefined;
}

function getPool() {
  if (!sharedPool) {
    sharedPool = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: getSslConfig(),
    });
  }

  return sharedPool;
}

async function withClient(work) {
  const client = await getPool().connect();
  try {
    return await work(client);
  } finally {
    client.release();
  }
}

async function withTransaction(work) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }
    throw error;
  } finally {
    client.release();
  }
}

async function closePool() {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}

module.exports = {
  closePool,
  getPool,
  withClient,
  withTransaction,
};

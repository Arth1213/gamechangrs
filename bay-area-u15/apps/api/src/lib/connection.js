const path = require("path");
const { Pool } = require("pg");
const { loadEnvFile } = require("./env");

loadEnvFile(path.resolve(process.cwd(), ".env"));

let sharedPool = null;

function getDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and update the database connection."
    );
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

async function testConnection() {
  const pool = getPool();
  const result = await pool.query(`
    select
      current_database() as database_name,
      current_user as current_user,
      now() as server_time
  `);

  return result.rows[0];
}

async function closePool() {
  if (sharedPool) {
    await sharedPool.end();
    sharedPool = null;
  }
}

module.exports = {
  closePool,
  getDatabaseUrl,
  getPool,
  testConnection,
};

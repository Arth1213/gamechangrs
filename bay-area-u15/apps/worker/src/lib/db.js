const path = require("path");
const { Pool } = require("pg");
const { loadEnvFile } = require("../../../api/src/lib/env");

loadEnvFile(path.resolve(process.cwd(), ".env"));

let sharedPool = null;

function attachClientErrorLogging(client) {
  let clientErrored = false;

  const onError = (error) => {
    clientErrored = true;
    console.error(`[worker-db] client error: ${error.message}`);
  };

  client.on("error", onError);

  return {
    hadError() {
      return clientErrored;
    },
    dispose() {
      client.off("error", onError);
    },
  };
}

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
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    sharedPool.on("error", (error) => {
      console.error(`[worker-db] pooled client error: ${error.message}`);
    });
  }

  return sharedPool;
}

async function withClient(work) {
  const client = await getPool().connect();
  const clientState = attachClientErrorLogging(client);
  try {
    return await work(client);
  } finally {
    clientState.dispose();
    client.release(clientState.hadError());
  }
}

async function withTransaction(work, options = {}) {
  const client = await getPool().connect();
  const clientState = attachClientErrorLogging(client);

  try {
    await client.query("BEGIN");
    const result = await work(client);
    if (options.rollback === true) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }
    return result;
  } catch (error) {
    try {
      if (!clientState.hadError()) {
        await client.query("ROLLBACK");
      }
    } catch (_) {
      // no-op
    }
    throw error;
  } finally {
    clientState.dispose();
    client.release(clientState.hadError());
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

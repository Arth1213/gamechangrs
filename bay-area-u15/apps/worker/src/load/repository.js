async function upsertDiscovery(discoveryResult) {
  return {
    ok: true,
    message: "TODO: wire discovery upserts into series and division tables.",
    discoveryResult,
  };
}

async function upsertMatchInventory(inventoryResult) {
  return {
    ok: true,
    message: "TODO: wire match inventory upserts into match table.",
    inventoryResult,
  };
}

async function upsertMatchFacts(matchFacts) {
  return {
    ok: true,
    message: "TODO: wire scorecard and commentary facts into schema tables.",
    matchFacts,
  };
}

module.exports = {
  upsertDiscovery,
  upsertMatchFacts,
  upsertMatchInventory,
};

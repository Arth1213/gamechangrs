const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildModernSeriesResultsUrl,
  buildModernDiscoveryReference,
} = require("../src/discovery/seriesDiscovery");

const milc2026Config = {
  label: "MiLC 2026",
  league_name: "MiLC",
  season_year: 2026,
  series_url:
    "https://cricclubs.com/MiLC/results?leagueId=4gjH8PVcUeCazKJUkOOrOA&year=2026&series=Blc41vvV_UlHFvY3oOajUg&division=all&seriesName=MiLC+2026",
  source_hints: {
    namespace: "MiLC",
    league_id: "4gjH8PVcUeCazKJUkOOrOA",
    series_id: "Blc41vvV_UlHFvY3oOajUg",
  },
};

test("keeps a modern MiLC results URL scoped to its configured 2026 series", () => {
  const result = buildModernSeriesResultsUrl(milc2026Config);

  const url = new URL(result);
  assert.equal(url.origin + url.pathname, "https://cricclubs.com/MiLC/results");
  assert.equal(url.searchParams.get("leagueId"), "4gjH8PVcUeCazKJUkOOrOA");
  assert.equal(url.searchParams.get("year"), "2026");
  assert.equal(url.searchParams.get("series"), "Blc41vvV_UlHFvY3oOajUg");
  assert.equal(url.searchParams.get("division"), "all");
});

test("uses the modern MiLC results route instead of a legacy league index", () => {
  assert.deepEqual(buildModernDiscoveryReference(milc2026Config), {
    label: "MiLC 2026",
    leagueId: "4gjH8PVcUeCazKJUkOOrOA",
    resultsUrl:
      "https://cricclubs.com/MiLC/results?leagueId=4gjH8PVcUeCazKJUkOOrOA&year=2026&series=Blc41vvV_UlHFvY3oOajUg&division=all&seriesName=MiLC+2026",
  });
});

test("derives modern MiLC identifiers from the registered source URL", () => {
  const registeredConfig = {
    ...milc2026Config,
    source_hints: {
      namespace: "MiLC",
      series_id: "Blc41vvV_UlHFvY3oOajUg",
    },
  };

  const url = new URL(buildModernSeriesResultsUrl(registeredConfig));
  assert.equal(url.searchParams.get("leagueId"), "4gjH8PVcUeCazKJUkOOrOA");
  assert.equal(url.searchParams.get("series"), "Blc41vvV_UlHFvY3oOajUg");
});

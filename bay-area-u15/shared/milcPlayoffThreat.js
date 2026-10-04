"use strict";

const PLAYOFF_TEAM_NAMES = require('../../config/grizzlies-2026-playoffs.json').teams;
const MILC_2026_KEY = 'bay-area-youth-cricket-hub-2026-milc-2026-blc41vvv-ulhfvy3ooajug';
const MILC_THREAT_VERSION = 'milc-2026-playoff-threat-v1';

function isMilcPlayoff(seriesConfigKey, teamName) {
  return seriesConfigKey === MILC_2026_KEY && PLAYOFF_TEAM_NAMES.includes(teamName);
}

function finiteMetric(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getMilcThreatTier(input) {
  const percentile = finiteMetric(input?.leaguePercentileRank);
  const matches = finiteMetric(input?.totalMatches);
  if (percentile === null || percentile < 0 || percentile > 100 || !Number.isInteger(matches) || matches < 3) return 'unknown';
  if (percentile >= 85) return 'red';
  if (percentile >= 60) return 'amber';
  return 'green';
}

module.exports = { MILC_2026_KEY, MILC_THREAT_VERSION, PLAYOFF_TEAM_NAMES, isMilcPlayoff, finiteMetric, getMilcThreatTier };

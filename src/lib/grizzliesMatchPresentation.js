const MONTH_NAMES = Object.freeze([
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]);

export function formatGrizzliesFixtureDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return "Date pending";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return "Date pending";
  const validationDate = new Date(Date.UTC(year, month - 1, day));
  if (
    validationDate.getUTCFullYear() !== year
    || validationDate.getUTCMonth() !== month - 1
    || validationDate.getUTCDate() !== day
  ) return "Date pending";
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export function formatGrizzliesMatchScores(innings) {
  return (Array.isArray(innings) ? innings : []).map((row) => {
    const runs = Number(row?.runs);
    const wickets = Number(row?.wickets);
    const legalBalls = Number(row?.legalBalls);
    return {
      teamName: String(row?.battingTeam || "Team"),
      score: `${Number.isFinite(runs) ? runs : 0}/${Number.isFinite(wickets) ? wickets : 0}`,
      overs: Number.isFinite(legalBalls) && legalBalls >= 0
        ? `${Math.floor(legalBalls / 6)}.${legalBalls % 6} overs`
        : "Overs unavailable",
    };
  });
}

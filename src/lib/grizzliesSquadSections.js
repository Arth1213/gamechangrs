import playoffConfig from "../../config/grizzlies-2026-playoffs.json" with { type: "json" };

export function groupGrizzliesSquads(teams = []) {
  const byName = new Map(teams.map(team => [team.name, team]));
  const playoffs = playoffConfig.teams.map(name => byName.get(name) || {
    name, section: "playoffs", dataStatus: "unavailable", players: [],
  });
  return [
    { id: "playoffs", title: "Playoffs", description: "Opponent player reports from recorded MiLC 2026 appearances. Not a confirmed playoff XI.", teams: playoffs },
    { id: "division", title: "Division", description: "Existing division opponent reports.", teams: ["Silicon Valley Strikers", "East Bay Blazers"].map(name => byName.get(name)).filter(Boolean) },
    { id: "grizzlies", title: "Grizzlies squad", description: "Your squad's existing player intelligence.", teams: teams.filter(team => team.name === "San Ramon Grizzlies") },
  ].filter(group => group.teams.length);
}

export function sortPlayersByReportAvailability(players) {
  return [...players].sort((left, right) =>
    Number(Boolean(right.assessmentPath || right.threatPath)) - Number(Boolean(left.assessmentPath || left.threatPath)));
}

export function playerReportNote(player) {
  if (player.dataNote) return player.dataNote;
  if (player.assessmentPath || player.threatPath) return null;
  return player.dataSource ? `${player.dataSource} analytics unavailable` : "NCCA data not found";
}

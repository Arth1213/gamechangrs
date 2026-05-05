import { supabase } from "@/integrations/supabase/client";

export interface SummaryCategoryOption {
  id: string;
  name: string;
}

type SummaryStringList = string[] | null | undefined;

export interface CoachSummarySource {
  name: string;
  location?: string | null;
  bio?: string | null;
  years_experience?: number | null;
  coaching_level?: string | null;
  specialties?: SummaryStringList;
  teams_coached?: SummaryStringList;
  notable_players_coached?: SummaryStringList;
  average_rating?: number | null;
  number_of_ratings?: number | null;
}

export interface PlayerSummarySource {
  name: string;
  location?: string | null;
  age_group?: string | null;
  playing_role?: string | null;
  experience_level?: string | null;
  matches_played?: number | null;
  batting_average?: number | null;
  batting_strike_rate?: number | null;
  bowling_economy?: number | null;
  best_figures?: string | null;
  training_categories_needed?: SummaryStringList;
}

function formatList(values: string[]) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function categoryNames(ids: SummaryStringList, categories: SummaryCategoryOption[]) {
  if (!ids?.length || categories.length === 0) {
    return [];
  }

  return ids
    .map((id) => categories.find((category) => category.id === id)?.name)
    .filter((value): value is string => Boolean(value));
}

function firstLine(text?: string | null) {
  if (!text) return null;
  const compact = text.replace(/\s+/g, " ").trim();
  return compact ? compact : null;
}

export function buildCoachSummaryRequest(coach: CoachSummarySource, categories: SummaryCategoryOption[]) {
  return {
    type: "coach" as const,
    name: coach.name,
    bio: coach.bio,
    location: coach.location,
    years_experience: coach.years_experience,
    coaching_level: coach.coaching_level,
    specialties: categoryNames(coach.specialties, categories),
    teams_coached: coach.teams_coached ?? [],
    notable_players_coached: coach.notable_players_coached ?? [],
    average_rating: coach.average_rating,
    number_of_ratings: coach.number_of_ratings,
  };
}

export function buildPlayerSummaryRequest(player: PlayerSummarySource, categories: SummaryCategoryOption[]) {
  return {
    type: "player" as const,
    name: player.name,
    location: player.location,
    age_group: player.age_group,
    playing_role: player.playing_role,
    experience_level: player.experience_level,
    matches_played: player.matches_played,
    batting_average: player.batting_average,
    batting_strike_rate: player.batting_strike_rate,
    bowling_economy: player.bowling_economy,
    best_figures: player.best_figures,
    training_categories_needed: categoryNames(player.training_categories_needed, categories),
  };
}

export function buildFallbackCoachSummary(coach: CoachSummarySource, categories: SummaryCategoryOption[]) {
  const specialties = categoryNames(coach.specialties, categories);
  const openerParts = [
    coach.location ? `${coach.name} is based in ${coach.location}` : coach.name,
    typeof coach.years_experience === "number" && coach.years_experience > 0
      ? `brings ${coach.years_experience} years of coaching experience`
      : null,
    coach.coaching_level ? `works across ${coach.coaching_level} development levels` : null,
  ].filter((value): value is string => Boolean(value));

  const detailParts = [
    specialties.length > 0 ? `Specialties include ${formatList(specialties.slice(0, 3))}` : null,
    coach.teams_coached?.length ? `Teams coached include ${formatList(coach.teams_coached.slice(0, 2))}` : null,
    coach.notable_players_coached?.length
      ? `Notable player work includes ${formatList(coach.notable_players_coached.slice(0, 2))}`
      : null,
    typeof coach.average_rating === "number" && coach.average_rating > 0
      ? `Current rating is ${coach.average_rating.toFixed(1)}/5`
      : null,
    firstLine(coach.bio),
  ].filter((value): value is string => Boolean(value));

  const firstSentence = `${openerParts.join(" and ")}.`.replace(/\s+\./g, ".");
  const secondSentence = detailParts.length > 0 ? ` ${detailParts[0]}.` : "";

  return `${firstSentence}${secondSentence}`.trim();
}

export function buildFallbackPlayerSummary(player: PlayerSummarySource, categories: SummaryCategoryOption[]) {
  const trainingFocus = categoryNames(player.training_categories_needed, categories);
  const openerParts = [
    player.name,
    player.location ? `is based in ${player.location}` : null,
    player.playing_role ? `plays as a ${player.playing_role}` : null,
    player.age_group ? `in the ${player.age_group} group` : null,
  ].filter((value): value is string => Boolean(value));

  const detailParts = [
    typeof player.matches_played === "number" && player.matches_played > 0
      ? `${player.matches_played} recorded matches`
      : null,
    typeof player.batting_average === "number" ? `batting average ${player.batting_average}` : null,
    typeof player.batting_strike_rate === "number" ? `strike rate ${player.batting_strike_rate}` : null,
    typeof player.bowling_economy === "number" ? `bowling economy ${player.bowling_economy}` : null,
    player.best_figures ? `best figures ${player.best_figures}` : null,
    trainingFocus.length > 0 ? `current training focus includes ${formatList(trainingFocus.slice(0, 3))}` : null,
  ].filter((value): value is string => Boolean(value));

  const firstSentence = `${openerParts.join(" ")}.`.replace(/\s+\./g, ".");
  const secondSentence = detailParts.length > 0 ? ` Profile highlights include ${detailParts.slice(0, 3).join(", ")}.` : "";

  return `${firstSentence}${secondSentence}`.trim();
}

export async function generateCoachCareerSummary(coach: CoachSummarySource, categories: SummaryCategoryOption[]) {
  const fallback = buildFallbackCoachSummary(coach, categories);

  try {
    const { data, error } = await supabase.functions.invoke("generate-career-summary", {
      body: buildCoachSummaryRequest(coach, categories),
    });

    if (error) {
      throw error;
    }

    const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
    return summary || fallback;
  } catch (error) {
    console.error("Error generating coach career summary:", error);
    return fallback;
  }
}

export async function generatePlayerCareerSummary(player: PlayerSummarySource, categories: SummaryCategoryOption[]) {
  const fallback = buildFallbackPlayerSummary(player, categories);

  try {
    const { data, error } = await supabase.functions.invoke("generate-career-summary", {
      body: buildPlayerSummaryRequest(player, categories),
    });

    if (error) {
      throw error;
    }

    const summary = typeof data?.summary === "string" ? data.summary.trim() : "";
    return summary || fallback;
  } catch (error) {
    console.error("Error generating player career summary:", error);
    return fallback;
  }
}

export function isMissingCareerSummaryColumnError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";

  return code === "PGRST204" || /career_summary/i.test(message);
}

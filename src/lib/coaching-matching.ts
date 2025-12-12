/**
 * Matching logic utilities for Coaching Marketplace
 */

import { Coach, Player, CoachWithDetails, PlayerWithDetails, MatchResult } from "@/types/coaching";

/**
 * Calculate category match percentage
 */
export function calculateCategoryMatch(
  coachCategories: string[],
  playerCategories: string[]
): number {
  if (playerCategories.length === 0) return 0;
  
  const matched = coachCategories.filter(cat => 
    playerCategories.includes(cat)
  ).length;
  
  return matched / playerCategories.length;
}

/**
 * Normalize years of experience (0-1 scale based on max in dataset)
 * For now, we'll use a reasonable max of 30 years
 */
export function normalizeExperience(years: number, maxYears: number = 30): number {
  return Math.min(years / maxYears, 1);
}

/**
 * Calculate location match score (0-1)
 * Returns higher score for closer/matching locations
 */
export function calculateLocationMatch(
  location1: string | null,
  location2: string | null
): number {
  if (!location1 || !location2) return 0.3; // Neutral score if no location

  const loc1 = location1.toLowerCase().trim();
  const loc2 = location2.toLowerCase().trim();

  // Exact match
  if (loc1 === loc2) return 1;

  // Check if one contains the other (city in region, etc.)
  if (loc1.includes(loc2) || loc2.includes(loc1)) return 0.9;

  // Check for common words (country, state, city parts)
  const words1 = loc1.split(/[,\s]+/).filter(w => w.length > 2);
  const words2 = loc2.split(/[,\s]+/).filter(w => w.length > 2);
  
  const commonWords = words1.filter(w => words2.some(w2 => w2.includes(w) || w.includes(w2)));
  
  if (commonWords.length > 0) {
    return 0.5 + (commonWords.length / Math.max(words1.length, words2.length)) * 0.4;
  }

  return 0.2; // Different locations
}

/**
 * Calculate match score for coach (from player's perspective)
 * Enhanced with location matching
 */
export function calculateCoachMatchScore(
  coach: Coach,
  player: Player,
  maxExperienceYears: number = 30
): MatchResult {
  const categoryMatch = calculateCategoryMatch(
    coach.specialties,
    player.training_categories_needed
  );
  
  const normalizedExperience = normalizeExperience(
    coach.years_experience,
    maxExperienceYears
  );
  
  const ratingScore = coach.adjusted_rating / 5;
  
  const locationMatch = calculateLocationMatch(coach.location, player.location);
  
  // Weighted score: categories (50%), location (20%), experience (15%), rating (15%)
  const matchScore = 
    (categoryMatch * 0.5) +
    (locationMatch * 0.2) +
    (normalizedExperience * 0.15) +
    (ratingScore * 0.15);
  
  return {
    coach: coach as CoachWithDetails,
    match_score: matchScore,
    category_match_percentage: categoryMatch * 100,
    experience_match: normalizedExperience,
    location_match: locationMatch,
  };
}

/**
 * Calculate match score for player (from coach's perspective)
 * Enhanced with location matching
 */
export function calculatePlayerMatchScore(
  player: Player,
  coach: Coach
): MatchResult {
  const categoryMatch = calculateCategoryMatch(
    coach.specialties,
    player.training_categories_needed
  );
  
  // Experience level match (beginner=0, intermediate=0.5, advanced=1)
  const experienceLevelMap: Record<string, number> = {
    beginner: 0,
    intermediate: 0.5,
    advanced: 1,
  };
  
  const coachLevel = experienceLevelMap[coach.coaching_level] ?? 0.5;
  const playerLevel = experienceLevelMap[player.experience_level] ?? 0.5;
  
  const experienceMatch = Math.abs(coachLevel - playerLevel);
  // Invert so closer levels = higher score
  const experienceLevelMatch = 1 - experienceMatch;
  
  const locationMatch = calculateLocationMatch(coach.location, player.location);
  
  // Weighted score: categories (50%), location (25%), experience level (25%)
  const matchScore = 
    (categoryMatch * 0.5) +
    (locationMatch * 0.25) +
    (experienceLevelMatch * 0.25);
  
  return {
    player: player as PlayerWithDetails,
    match_score: matchScore,
    category_match_percentage: categoryMatch * 100,
    experience_match: experienceLevelMatch,
    location_match: locationMatch,
  };
}

/**
 * Sort coaches by match score (descending)
 */
export function sortCoachesByMatch(
  coaches: Coach[],
  player: Player,
  maxExperienceYears?: number
): MatchResult[] {
  return coaches
    .map(coach => calculateCoachMatchScore(coach, player, maxExperienceYears))
    .sort((a, b) => b.match_score - a.match_score);
}

/**
 * Sort players by match score (descending)
 */
export function sortPlayersByMatch(
  players: Player[],
  coach: Coach
): MatchResult[] {
  return players
    .map(player => calculatePlayerMatchScore(player, coach))
    .sort((a, b) => b.match_score - a.match_score);
}

/**
 * Get top recommended coaches for a player
 */
export function getRecommendedCoaches(
  coaches: Coach[],
  player: Player,
  limit: number = 3
): MatchResult[] {
  const sortedMatches = sortCoachesByMatch(coaches, player);
  return sortedMatches.slice(0, limit).filter(m => m.match_score > 0.3);
}

/**
 * Get top recommended players for a coach
 */
export function getRecommendedPlayers(
  players: Player[],
  coach: Coach,
  limit: number = 3
): MatchResult[] {
  const sortedMatches = sortPlayersByMatch(players, coach);
  return sortedMatches.slice(0, limit).filter(m => m.match_score > 0.3);
}

/**
 * Filter coaches by location (if provided)
 */
export function filterByLocation<T extends { location: string | null }>(
  items: T[],
  playerLocation: string | null
): T[] {
  if (!playerLocation) return items;
  
  return items.filter(item => {
    if (!item.location) return true;
    // Simple location matching (case-insensitive contains)
    return item.location.toLowerCase().includes(playerLocation.toLowerCase()) ||
           playerLocation.toLowerCase().includes(item.location.toLowerCase());
  });
}

/**
 * Filter by preferred mode
 */
export function filterByPreferredMode(
  coaches: Coach[],
  playerPreferredMode: 'online' | 'in-person' | 'either'
): Coach[] {
  // For now, all coaches support both modes
  // In future, coaches could have preferred_mode field
  return coaches;
}

/**
 * Get max experience years from coach array
 */
export function getMaxExperienceYears(coaches: Coach[]): number {
  if (coaches.length === 0) return 30;
  return Math.max(...coaches.map(c => c.years_experience), 30);
}


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
 * Calculate match score for coach (from player's perspective)
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
  
  const matchScore = 
    (categoryMatch * 0.6) +
    (normalizedExperience * 0.2) +
    (ratingScore * 0.2);
  
  return {
    coach: coach as CoachWithDetails,
    match_score: matchScore,
    category_match_percentage: categoryMatch * 100,
    experience_match: normalizedExperience,
  };
}

/**
 * Calculate match score for player (from coach's perspective)
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
  
  const experienceMatch = Math.abs(
    experienceLevelMap[coach.coaching_level] - 
    experienceLevelMap[player.experience_level]
  );
  // Invert so closer levels = higher score
  const experienceLevelMatch = 1 - experienceMatch;
  
  const matchScore = 
    (categoryMatch * 0.7) +
    (experienceLevelMatch * 0.3);
  
  return {
    player: player as PlayerWithDetails,
    match_score: matchScore,
    category_match_percentage: categoryMatch * 100,
    experience_match: experienceLevelMatch,
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


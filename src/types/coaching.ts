/**
 * TypeScript types for the Coaching Marketplace system
 */

export type CoachingLevel = 'beginner' | 'intermediate' | 'advanced';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';
export type PreferredMode = 'online' | 'in-person' | 'either';
export type SessionStatus = 'pending' | 'confirmed' | 'completed' | 'canceled';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface CoachingCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Coach {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  timezone: string;
  profile_picture_url: string | null;
  
  // Coaching Details
  specialties: string[]; // Array of category IDs
  coaching_level: CoachingLevel;
  years_experience: number;
  teams_coached: string[];
  notable_players_coached: string[];
  external_links: string[];
  bio: string | null;
  career_summary: string | null;
  
  // Ratings
  number_of_ratings: number;
  average_rating: number;
  adjusted_rating: number;
  
  // Profile status
  is_active: boolean;
  is_verified: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface Player {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  location: string | null;
  timezone: string;
  profile_picture_url: string | null;
  
  // Player Details
  age_group: string | null;
  playing_role: string | null;
  training_categories_needed: string[]; // Array of category IDs
  experience_level: ExperienceLevel;
  
  // Structured Stats
  matches_played: number;
  batting_strike_rate: number | null;
  batting_average: number | null;
  bowling_economy: number | null;
  best_figures: string | null;
  external_links: string[];
  career_summary: string | null;
  
  // Preferences
  preferred_mode: PreferredMode;
  preferred_days: string[];
  preferred_time_range: string | null;
  
  // Profile status
  is_active: boolean;
  
  created_at: string;
  updated_at: string;
}

export interface Connection {
  id: string;
  student_id: string;
  coach_id: string;
  code: string;
  expires_at: string;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  status?: string;
  requester_type?: string;
  requester_email?: string;
  recipient_email?: string;
}

export interface CoachAvailability {
  id: string;
  coach_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  start_time_utc: string; // TIME format
  end_time_utc: string; // TIME format
  specific_date?: string | null; // DATE format - when set, uses this specific date instead of day_of_week
  created_at: string;
}

export interface BlockedDate {
  id: string;
  coach_id: string;
  blocked_date: string; // DATE format
  reason: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  coach_id: string;
  student_id: string;
  session_date_time_utc: string;
  duration_minutes: number;
  status: SessionStatus;
  cancellation_reason: string | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Rating {
  id: string;
  session_id: string;
  coach_id: string;
  student_id: string;
  rating: number; // 1-5
  review_text: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator';
  created_at: string;
}

export interface ReportedProfile {
  id: string;
  reported_by_user_id: string;
  profile_type: 'coach' | 'player';
  profile_id: string;
  reason: string;
  status: ReportStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

// Extended types with related data
export interface CoachWithDetails extends Coach {
  categories?: CoachingCategory[];
  availability?: CoachAvailability[];
  blocked_dates?: BlockedDate[];
  connection?: Connection | null;
  match_score?: number;
}

export interface PlayerWithDetails extends Player {
  categories?: CoachingCategory[];
  connection?: Connection | null;
  match_score?: number;
}

export interface SessionWithDetails extends Session {
  coach?: Coach;
  student?: Player;
  rating?: Rating | null;
}

// Form types
export interface CoachProfileForm {
  name: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  specialties: string[];
  coaching_level: CoachingLevel;
  years_experience: number;
  teams_coached: string[];
  notable_players_coached: string[];
  external_links: string[];
  bio: string;
}

export interface PlayerProfileForm {
  name: string;
  email: string;
  phone: string;
  location: string;
  timezone: string;
  age_group: string;
  playing_role: string;
  training_categories_needed: string[];
  experience_level: ExperienceLevel;
  matches_played: number;
  batting_strike_rate: number | null;
  batting_average: number | null;
  bowling_economy: number | null;
  best_figures: string;
  external_links: string[];
  preferred_mode: PreferredMode;
  preferred_days: string[];
  preferred_time_range: string;
}

// Matching types
export interface MatchResult {
  coach?: CoachWithDetails;
  player?: PlayerWithDetails;
  match_score: number;
  category_match_percentage: number;
  experience_match: number;
  location_match?: number;
}

// Connection request types
export interface ConnectionRequest {
  coach_id?: string;
  student_id?: string;
}

export interface ConnectionVerification {
  code: string;
  connection_id: string;
}

// Session booking types
export interface SessionBooking {
  coach_id: string;
  session_date_time_utc: string;
  duration_minutes: number;
}

// Time slot types
export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  existing_session?: Session;
}

export interface WeeklyAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      analysis_results: {
        Row: {
          angles: Json
          created_at: string
          drills: Json | null
          feedback: Json | null
          id: string
          mode: string
          overall_score: number
          scores: Json
          user_id: string
          video_duration: string | null
          video_url: string | null
        }
        Insert: {
          angles: Json
          created_at?: string
          drills?: Json | null
          feedback?: Json | null
          id?: string
          mode: string
          overall_score: number
          scores: Json
          user_id: string
          video_duration?: string | null
          video_url?: string | null
        }
        Update: {
          angles?: Json
          created_at?: string
          drills?: Json | null
          feedback?: Json | null
          id?: string
          mode?: string
          overall_score?: number
          scores?: Json
          user_id?: string
          video_duration?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      blocked_dates: {
        Row: {
          blocked_date: string
          coach_id: string
          created_at: string
          id: string
          reason: string | null
        }
        Insert: {
          blocked_date: string
          coach_id: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Update: {
          blocked_date?: string
          coach_id?: string
          created_at?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocked_dates_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          coach_id: string
          created_at: string
          day_of_week: number
          end_time_utc: string
          id: string
          specific_date: string | null
          start_time_utc: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          day_of_week: number
          end_time_utc: string
          id?: string
          specific_date?: string | null
          start_time_utc: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          day_of_week?: number
          end_time_utc?: string
          id?: string
          specific_date?: string | null
          start_time_utc?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
        ]
      }
      coaches: {
        Row: {
          adjusted_rating: number | null
          average_rating: number | null
          bio: string | null
          coaching_level: string | null
          created_at: string
          email: string
          external_links: string[] | null
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          location: string | null
          name: string
          notable_players_coached: string[] | null
          number_of_ratings: number | null
          phone: string | null
          profile_picture_url: string | null
          specialties: string[] | null
          teams_coached: string[] | null
          timezone: string | null
          updated_at: string
          user_id: string
          years_experience: number | null
        }
        Insert: {
          adjusted_rating?: number | null
          average_rating?: number | null
          bio?: string | null
          coaching_level?: string | null
          created_at?: string
          email: string
          external_links?: string[] | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          name: string
          notable_players_coached?: string[] | null
          number_of_ratings?: number | null
          phone?: string | null
          profile_picture_url?: string | null
          specialties?: string[] | null
          teams_coached?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          years_experience?: number | null
        }
        Update: {
          adjusted_rating?: number | null
          average_rating?: number | null
          bio?: string | null
          coaching_level?: string | null
          created_at?: string
          email?: string
          external_links?: string[] | null
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          name?: string
          notable_players_coached?: string[] | null
          number_of_ratings?: number | null
          phone?: string | null
          profile_picture_url?: string | null
          specialties?: string[] | null
          teams_coached?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          years_experience?: number | null
        }
        Relationships: []
      }
      coaching_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      connections: {
        Row: {
          coach_id: string
          code: string
          created_at: string
          expires_at: string
          id: string
          recipient_email: string | null
          requester_email: string | null
          requester_type: string | null
          status: string | null
          student_id: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          coach_id: string
          code: string
          created_at?: string
          expires_at: string
          id?: string
          recipient_email?: string | null
          requester_email?: string | null
          requester_type?: string | null
          status?: string | null
          student_id: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          coach_id?: string
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          recipient_email?: string | null
          requester_email?: string | null
          requester_type?: string | null
          status?: string | null
          student_id?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "connections_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          condition: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          listing_type: string
          location: string | null
          original_price: number | null
          price: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          condition?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          listing_type?: string
          location?: string | null
          original_price?: number | null
          price?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          listing_type?: string
          location?: string | null
          original_price?: number | null
          price?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          age_group: string | null
          batting_average: number | null
          batting_strike_rate: number | null
          best_figures: string | null
          bowling_economy: number | null
          created_at: string
          email: string
          experience_level: string | null
          external_links: string[] | null
          id: string
          is_active: boolean | null
          location: string | null
          matches_played: number | null
          name: string
          phone: string | null
          playing_role: string | null
          preferred_days: string[] | null
          preferred_mode: string | null
          preferred_time_range: string | null
          profile_picture_url: string | null
          timezone: string | null
          training_categories_needed: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          age_group?: string | null
          batting_average?: number | null
          batting_strike_rate?: number | null
          best_figures?: string | null
          bowling_economy?: number | null
          created_at?: string
          email: string
          experience_level?: string | null
          external_links?: string[] | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          matches_played?: number | null
          name: string
          phone?: string | null
          playing_role?: string | null
          preferred_days?: string[] | null
          preferred_mode?: string | null
          preferred_time_range?: string | null
          profile_picture_url?: string | null
          timezone?: string | null
          training_categories_needed?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          age_group?: string | null
          batting_average?: number | null
          batting_strike_rate?: number | null
          best_figures?: string | null
          bowling_economy?: number | null
          created_at?: string
          email?: string
          experience_level?: string | null
          external_links?: string[] | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          matches_played?: number | null
          name?: string
          phone?: string | null
          playing_role?: string | null
          preferred_days?: string[] | null
          preferred_mode?: string | null
          preferred_time_range?: string | null
          profile_picture_url?: string | null
          timezone?: string | null
          training_categories_needed?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          playing_position: string | null
          preferred_sport: string | null
          skill_level: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          playing_position?: string | null
          preferred_sport?: string | null
          skill_level?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          playing_position?: string | null
          preferred_sport?: string | null
          skill_level?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          coach_id: string
          created_at: string
          id: string
          rating: number
          review_text: string | null
          session_id: string
          student_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          id?: string
          rating: number
          review_text?: string | null
          session_id: string
          student_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          id?: string
          rating?: number
          review_text?: string | null
          session_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_contacts: {
        Row: {
          contact_email: string
          created_at: string
          id: string
          listing_id: string
        }
        Insert: {
          contact_email: string
          created_at?: string
          id?: string
          listing_id: string
        }
        Update: {
          contact_email?: string
          created_at?: string
          id?: string
          listing_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_contacts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seller_contacts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "public_marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          canceled_at: string | null
          cancellation_reason: string | null
          coach_id: string
          created_at: string
          duration_minutes: number | null
          id: string
          session_date_time_utc: string
          status: string | null
          student_id: string
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          coach_id: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          session_date_time_utc: string
          status?: string | null
          student_id: string
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          cancellation_reason?: string | null
          coach_id?: string
          created_at?: string
          duration_minutes?: number | null
          id?: string
          session_date_time_utc?: string
          status?: string | null
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_marketplace_listings: {
        Row: {
          category: string | null
          condition: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_active: boolean | null
          is_owner: boolean | null
          listing_type: string | null
          location: string | null
          original_price: number | null
          price: number | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_owner?: never
          listing_type?: string | null
          location?: string | null
          original_price?: number | null
          price?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          condition?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_url?: string | null
          is_active?: boolean | null
          is_owner?: never
          listing_type?: string | null
          location?: string | null
          original_price?: number | null
          price?: number | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_public_site_metric_snapshot: {
        Args: Record<PropertyKey, never>
        Returns: {
          gear_donation_count: number
          video_analysis_count: number
        }[]
      }
      get_user_coach_id: { Args: { _user_id: string }; Returns: string }
      get_user_player_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_owns_coach: {
        Args: { _coach_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_player: {
        Args: { _player_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const

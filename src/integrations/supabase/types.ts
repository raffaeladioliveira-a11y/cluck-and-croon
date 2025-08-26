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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      "cluck-and-croon": {
        Row: {
          created_at: string
          id: number
        }
        Insert: {
          created_at?: string
          id?: number
        }
        Update: {
          created_at?: string
          id?: number
        }
        Relationships: []
      }
      game_rooms: {
        Row: {
          code: string | null
          created_at: string
          current_players: number | null
          current_round: number | null
          current_set: number | null
          current_song_id: string | null
          eggs_per_correct: number | null
          finished_at: string | null
          game_session_id: string | null
          host_id: string
          host_participant_id: string | null
          host_user_id: string | null
          id: string
          max_players: number | null
          name: string
          next_genre_id: string | null
          room_code: string
          rounds_total: number | null
          speed_bonus: number | null
          started_at: string | null
          status: string | null
          time_per_question: number | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          current_players?: number | null
          current_round?: number | null
          current_set?: number | null
          current_song_id?: string | null
          eggs_per_correct?: number | null
          finished_at?: string | null
          game_session_id?: string | null
          host_id: string
          host_participant_id?: string | null
          host_user_id?: string | null
          id?: string
          max_players?: number | null
          name: string
          next_genre_id?: string | null
          room_code: string
          rounds_total?: number | null
          speed_bonus?: number | null
          started_at?: string | null
          status?: string | null
          time_per_question?: number | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          current_players?: number | null
          current_round?: number | null
          current_set?: number | null
          current_song_id?: string | null
          eggs_per_correct?: number | null
          finished_at?: string | null
          game_session_id?: string | null
          host_id?: string
          host_participant_id?: string | null
          host_user_id?: string | null
          id?: string
          max_players?: number | null
          name?: string
          next_genre_id?: string | null
          room_code?: string
          rounds_total?: number | null
          speed_bonus?: number | null
          started_at?: string | null
          status?: string | null
          time_per_question?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rooms_current_song_id_fkey"
            columns: ["current_song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rooms_next_genre_id_fkey"
            columns: ["next_genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rounds: {
        Row: {
          correct_answer: string
          created_at: string
          ended_at: string | null
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          room_id: string
          round_number: number
          song_id: string
          started_at: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string
          ended_at?: string | null
          id?: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          room_id: string
          round_number: number
          song_id: string
          started_at?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          room_id?: string
          round_number?: number
          song_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_rounds_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_rounds_song_id_fkey"
            columns: ["song_id"]
            isOneToOne: false
            referencedRelation: "songs"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          ended_at: string | null
          id: string
          room_code: string
          seed: number
          started_at: string
          status: string
          tracks: string[]
        }
        Insert: {
          ended_at?: string | null
          id?: string
          room_code: string
          seed?: number
          started_at?: string
          status?: string
          tracks?: string[]
        }
        Update: {
          ended_at?: string | null
          id?: string
          room_code?: string
          seed?: number
          started_at?: string
          status?: string
          tracks?: string[]
        }
        Relationships: []
      }
      game_settings: {
        Row: {
          created_at: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      genres: {
        Row: {
          chicken_description: string | null
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          name: string
        }
        Insert: {
          chicken_description?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          name: string
        }
        Update: {
          chicken_description?: string | null
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      player_answers: {
        Row: {
          answered_at: string
          eggs_earned: number | null
          id: string
          is_correct: boolean
          response_time_seconds: number | null
          round_id: string
          selected_answer: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          eggs_earned?: number | null
          id?: string
          is_correct: boolean
          response_time_seconds?: number | null
          round_id: string
          selected_answer: string
          user_id: string
        }
        Update: {
          answered_at?: string
          eggs_earned?: number | null
          id?: string
          is_correct?: boolean
          response_time_seconds?: number | null
          round_id?: string
          selected_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_answers_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "game_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_emoji: string | null
          created_at: string
          display_name: string
          games_played: number | null
          games_won: number | null
          id: string
          total_eggs: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_emoji?: string | null
          created_at?: string
          display_name: string
          games_played?: number | null
          games_won?: number | null
          id?: string
          total_eggs?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_emoji?: string | null
          created_at?: string
          display_name?: string
          games_played?: number | null
          games_won?: number | null
          id?: string
          total_eggs?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_participants: {
        Row: {
          avatar_emoji: string | null
          avatar_user: string | null
          client_id: string | null
          current_eggs: number | null
          display_name: string
          display_name_user: string | null
          id: string
          is_host: boolean | null
          is_ready: boolean | null
          joined_at: string
          room_id: string
          user_id: string | null
        }
        Insert: {
          avatar_emoji?: string | null
          avatar_user?: string | null
          client_id?: string | null
          current_eggs?: number | null
          display_name: string
          display_name_user?: string | null
          id?: string
          is_host?: boolean | null
          is_ready?: boolean | null
          joined_at?: string
          room_id: string
          user_id?: string | null
        }
        Update: {
          avatar_emoji?: string | null
          avatar_user?: string | null
          client_id?: string | null
          current_eggs?: number | null
          display_name?: string
          display_name_user?: string | null
          id?: string
          is_host?: boolean | null
          is_ready?: boolean | null
          joined_at?: string
          room_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      songs: {
        Row: {
          album_name: string | null
          artist: string
          audio_file_url: string | null
          created_at: string
          difficulty_level: number | null
          duration_seconds: number | null
          genre_id: string | null
          id: string
          is_active: boolean | null
          play_count: number | null
          preview_url: string | null
          release_year: number | null
          spotify_url: string | null
          title: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          album_name?: string | null
          artist: string
          audio_file_url?: string | null
          created_at?: string
          difficulty_level?: number | null
          duration_seconds?: number | null
          genre_id?: string | null
          id?: string
          is_active?: boolean | null
          play_count?: number | null
          preview_url?: string | null
          release_year?: number | null
          spotify_url?: string | null
          title: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          album_name?: string | null
          artist?: string
          audio_file_url?: string | null
          created_at?: string
          difficulty_level?: number | null
          duration_seconds?: number | null
          genre_id?: string | null
          id?: string
          is_active?: boolean | null
          play_count?: number | null
          preview_url?: string | null
          release_year?: number | null
          spotify_url?: string | null
          title?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "songs_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_room_with_host: {
        Args: { p_avatar: string; p_client_id: string; p_display_name: string }
        Returns: string
      }
      generate_unique_room_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      join_room: {
        Args: {
          p_avatar: string
          p_client_id: string
          p_display_name: string
          p_room_code: string
        }
        Returns: string
      }
      join_room_with_identity: {
        Args: {
          p_avatar: string
          p_client_id: string
          p_display_name: string
          p_room_code: string
        }
        Returns: string
      }
      start_game: {
        Args: { p_client_id: string; p_room_code: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

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
      ad_details_cache: {
        Row: {
          ad_url: string
          condition: string | null
          contact_info: Json | null
          created_at: string
          description: string | null
          id: string
          images: Json | null
          location: string | null
          price_amount: number | null
          price_text: string | null
          seller: Json | null
          specifications: Json | null
          title: string | null
          updated_at: string
        }
        Insert: {
          ad_url: string
          condition?: string | null
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          location?: string | null
          price_amount?: number | null
          price_text?: string | null
          seller?: Json | null
          specifications?: Json | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          ad_url?: string
          condition?: string | null
          contact_info?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          images?: Json | null
          location?: string | null
          price_amount?: number | null
          price_text?: string | null
          seller?: Json | null
          specifications?: Json | null
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ad_listings_cache: {
        Row: {
          ad_path: string | null
          ad_url: string
          category: string | null
          created_at: string | null
          date: string | null
          description: string | null
          first_seen_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          last_seen_at: string | null
          location: string | null
          price_amount: number | null
          price_text: string | null
          source_category: string | null
          source_id: string | null
          source_name: string | null
          title: string
        }
        Insert: {
          ad_path?: string | null
          ad_url: string
          category?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_seen_at?: string | null
          location?: string | null
          price_amount?: number | null
          price_text?: string | null
          source_category?: string | null
          source_id?: string | null
          source_name?: string | null
          title: string
        }
        Update: {
          ad_path?: string | null
          ad_url?: string
          category?: string | null
          created_at?: string | null
          date?: string | null
          description?: string | null
          first_seen_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_seen_at?: string | null
          location?: string | null
          price_amount?: number | null
          price_text?: string | null
          source_category?: string | null
          source_id?: string | null
          source_name?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_listings_cache_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraping_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      category_mappings: {
        Row: {
          created_at: string
          external_category: string
          id: string
          internal_category: string
          source_id: string
        }
        Insert: {
          created_at?: string
          external_category: string
          id?: string
          internal_category: string
          source_id: string
        }
        Update: {
          created_at?: string
          external_category?: string
          id?: string
          internal_category?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_mappings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraping_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      scraping_sources: {
        Row: {
          base_url: string
          config: Json | null
          created_at: string
          id: string
          is_active: boolean
          last_sync_at: string | null
          last_sync_count: number | null
          last_sync_status: string | null
          name: string
          scrape_url: string
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at: string
        }
        Insert: {
          base_url: string
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_count?: number | null
          last_sync_status?: string | null
          name: string
          scrape_url: string
          source_type: Database["public"]["Enums"]["source_type"]
          updated_at?: string
        }
        Update: {
          base_url?: string
          config?: Json | null
          created_at?: string
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          last_sync_count?: number | null
          last_sync_status?: string | null
          name?: string
          scrape_url?: string
          source_type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
        }
        Relationships: []
      }
      sync_logs: {
        Row: {
          ads_found: number | null
          ads_new: number | null
          ads_removed: number | null
          ads_updated: number | null
          abort_reason: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          image_ratio: number | null
          invalid_ads: number | null
          invalid_ratio: number | null
          source_id: string
          started_at: string
          status: string
          total_ads_fetched: number | null
          valid_ads: number | null
        }
        Insert: {
          ads_found?: number | null
          ads_new?: number | null
          ads_removed?: number | null
          ads_updated?: number | null
          abort_reason?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_ratio?: number | null
          invalid_ads?: number | null
          invalid_ratio?: number | null
          source_id: string
          started_at?: string
          status?: string
          total_ads_fetched?: number | null
          valid_ads?: number | null
        }
        Update: {
          ads_found?: number | null
          ads_new?: number | null
          ads_removed?: number | null
          ads_updated?: number | null
          abort_reason?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          image_ratio?: number | null
          invalid_ads?: number | null
          invalid_ratio?: number | null
          source_id?: string
          started_at?: string
          status?: string
          total_ads_fetched?: number | null
          valid_ads?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "scraping_sources"
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
          role: Database["public"]["Enums"]["app_role"]
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
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      source_type: "parsebot" | "firecrawl_list" | "firecrawl_crawl"
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
      app_role: ["admin", "user"],
      source_type: ["parsebot", "firecrawl_list", "firecrawl_crawl"],
    },
  },
} as const

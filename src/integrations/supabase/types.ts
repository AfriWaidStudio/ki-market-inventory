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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      market_inventory_api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          encrypted_secret: string
          exchange: string
          id: string
          key_label: string
          permissions: string
          user_id: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          encrypted_secret: string
          exchange: string
          id?: string
          key_label: string
          permissions?: string
          user_id: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          encrypted_secret?: string
          exchange?: string
          id?: string
          key_label?: string
          permissions?: string
          user_id?: string
        }
        Relationships: []
      }
      market_inventory_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      market_inventory_daily_reports: {
        Row: {
          avg_duration_minutes: number | null
          best_route: string | null
          created_at: string
          id: string
          report_date: string
          total_profit: number
          trade_count: number
          user_id: string
          win_rate: number | null
        }
        Insert: {
          avg_duration_minutes?: number | null
          best_route?: string | null
          created_at?: string
          id?: string
          report_date: string
          total_profit?: number
          trade_count?: number
          user_id: string
          win_rate?: number | null
        }
        Update: {
          avg_duration_minutes?: number | null
          best_route?: string | null
          created_at?: string
          id?: string
          report_date?: string
          total_profit?: number
          trade_count?: number
          user_id?: string
          win_rate?: number | null
        }
        Relationships: []
      }
      market_inventory_exchange_accounts: {
        Row: {
          created_at: string
          exchange: string
          id: string
          is_active: boolean
          label: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          exchange: string
          id?: string
          is_active?: boolean
          label?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          exchange?: string
          id?: string
          is_active?: boolean
          label?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_inventory_price_snapshots: {
        Row: {
          asset: string
          captured_at: string
          currency: string
          exchange: string
          id: string
          liquidity_score: number | null
          merchant_count: number | null
          merchant_rating: number | null
          price: number
          side: string
          user_id: string
        }
        Insert: {
          asset?: string
          captured_at?: string
          currency?: string
          exchange: string
          id?: string
          liquidity_score?: number | null
          merchant_count?: number | null
          merchant_rating?: number | null
          price: number
          side: string
          user_id: string
        }
        Update: {
          asset?: string
          captured_at?: string
          currency?: string
          exchange?: string
          id?: string
          liquidity_score?: number | null
          merchant_count?: number | null
          merchant_rating?: number | null
          price?: number
          side?: string
          user_id?: string
        }
        Relationships: []
      }
      market_inventory_risk_alerts: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          message: string
          related_trade_id: string | null
          severity: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message: string
          related_trade_id?: string | null
          severity: string
          user_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          message?: string
          related_trade_id?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_risk_alerts_related_trade_id_fkey"
            columns: ["related_trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_trade_notes: {
        Row: {
          created_at: string
          id: string
          note: string
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note: string
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_trade_notes_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_trades: {
        Row: {
          actual_profit: number | null
          actual_sell_price: number | null
          amount: number
          asset: string
          buy_exchange: string
          buy_price: number
          buy_time: string
          confidence_score: number | null
          created_at: string
          currency: string
          duration_minutes: number | null
          estimated_fees: number
          expected_profit: number | null
          expected_sell_price: number | null
          final_fees: number | null
          id: string
          ki_accuracy_verdict: string | null
          ki_reasoning: string | null
          lesson_learned: string | null
          risk_score: number | null
          route: string | null
          sell_exchange: string
          sell_time: string | null
          status: Database["public"]["Enums"]["trade_status"]
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          actual_profit?: number | null
          actual_sell_price?: number | null
          amount: number
          asset?: string
          buy_exchange: string
          buy_price: number
          buy_time?: string
          confidence_score?: number | null
          created_at?: string
          currency?: string
          duration_minutes?: number | null
          estimated_fees?: number
          expected_profit?: number | null
          expected_sell_price?: number | null
          final_fees?: number | null
          id?: string
          ki_accuracy_verdict?: string | null
          ki_reasoning?: string | null
          lesson_learned?: string | null
          risk_score?: number | null
          route?: string | null
          sell_exchange: string
          sell_time?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          actual_profit?: number | null
          actual_sell_price?: number | null
          amount?: number
          asset?: string
          buy_exchange?: string
          buy_price?: number
          buy_time?: string
          confidence_score?: number | null
          created_at?: string
          currency?: string
          duration_minutes?: number | null
          estimated_fees?: number
          expected_profit?: number | null
          expected_sell_price?: number | null
          final_fees?: number | null
          id?: string
          ki_accuracy_verdict?: string | null
          ki_reasoning?: string | null
          lesson_learned?: string | null
          risk_score?: number | null
          route?: string | null
          sell_exchange?: string
          sell_time?: string | null
          status?: Database["public"]["Enums"]["trade_status"]
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          preferred_currency: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          preferred_currency?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          preferred_currency?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      trade_status: "active" | "closed" | "cancelled"
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
      trade_status: ["active", "closed", "cancelled"],
    },
  },
} as const

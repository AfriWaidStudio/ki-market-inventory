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
      app_users: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          password_hash: string | null
          smai_id: string
          smai_verification_notes: Json
          smai_verification_status: string
          smai_verified_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          password_hash?: string | null
          smai_id: string
          smai_verification_notes?: Json
          smai_verification_status?: string
          smai_verified_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          password_hash?: string | null
          smai_id?: string
          smai_verification_notes?: Json
          smai_verification_status?: string
          smai_verified_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      auth_identities: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          provider: string
          provider_email: string | null
          provider_subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          provider: string
          provider_email?: string | null
          provider_subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string
          provider_email?: string | null
          provider_subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_identities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_activity_at: string
          revoked_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          last_activity_at?: string
          revoked_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_activity_at?: string
          revoked_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_alert_deliveries: {
        Row: {
          alert_id: string
          attempts: number
          channel: string
          error_message: string | null
          id: string
          next_attempt_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          alert_id: string
          attempts?: number
          channel: string
          error_message?: string | null
          id?: string
          next_attempt_at?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          alert_id?: string
          attempts?: number
          channel?: string
          error_message?: string | null
          id?: string
          next_attempt_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ki_alert_deliveries_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "ki_operator_alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          external_message_id: string | null
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          external_message_id?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "ki_conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ki_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_conversations: {
        Row: {
          channel: string
          created_at: string
          external_thread_id: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          external_thread_id?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ki_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_model_metrics: {
        Row: {
          calibration_error: number | null
          created_at: string
          direction_accuracy: number | null
          feed_uptime: number | null
          fiat: string
          id: number
          metric_date: string
          model_version: string
          sample_count: number
          target_hit_rate: number | null
        }
        Insert: {
          calibration_error?: number | null
          created_at?: string
          direction_accuracy?: number | null
          feed_uptime?: number | null
          fiat: string
          id?: never
          metric_date: string
          model_version: string
          sample_count: number
          target_hit_rate?: number | null
        }
        Update: {
          calibration_error?: number | null
          created_at?: string
          direction_accuracy?: number | null
          feed_uptime?: number | null
          fiat?: string
          id?: never
          metric_date?: string
          model_version?: string
          sample_count?: number
          target_hit_rate?: number | null
        }
        Relationships: []
      }
      ki_operator_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          dedupe_key: string
          evidence: Json
          id: string
          message: string
          severity: string
          title: string
          trade_id: string | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string
          dedupe_key: string
          evidence?: Json
          id?: string
          message: string
          severity: string
          title: string
          trade_id?: string | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          dedupe_key?: string
          evidence?: Json
          id?: string
          message?: string
          severity?: string
          title?: string
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ki_operator_alerts_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ki_operator_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_position_plans: {
        Row: {
          action: string
          active: boolean
          break_even_price: number
          computed_at: string
          confidence: number | null
          confidence_eligible: boolean
          downside: number | null
          evidence: Json
          executable_amount: number | null
          executable_price: number | null
          expected_net: number | null
          id: string
          invalidation_condition: string
          missing_data: string[]
          model_version: string
          next_evaluation_at: string
          regime: string
          target_price: number
          target_window_hours: number | null
          trade_id: string
          user_id: string
          venue: string | null
        }
        Insert: {
          action: string
          active?: boolean
          break_even_price: number
          computed_at?: string
          confidence?: number | null
          confidence_eligible?: boolean
          downside?: number | null
          evidence?: Json
          executable_amount?: number | null
          executable_price?: number | null
          expected_net?: number | null
          id?: string
          invalidation_condition: string
          missing_data?: string[]
          model_version: string
          next_evaluation_at: string
          regime: string
          target_price: number
          target_window_hours?: number | null
          trade_id: string
          user_id: string
          venue?: string | null
        }
        Update: {
          action?: string
          active?: boolean
          break_even_price?: number
          computed_at?: string
          confidence?: number | null
          confidence_eligible?: boolean
          downside?: number | null
          evidence?: Json
          executable_amount?: number | null
          executable_price?: number | null
          expected_net?: number | null
          id?: string
          invalidation_condition?: string
          missing_data?: string[]
          model_version?: string
          next_evaluation_at?: string
          regime?: string
          target_price?: number
          target_window_hours?: number | null
          trade_id?: string
          user_id?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ki_position_plans_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ki_position_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_recommendation_feedback: {
        Row: {
          created_at: string
          id: string
          note: string | null
          rating: string
          recommendation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          rating: string
          recommendation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          rating?: string
          recommendation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ki_recommendation_feedback_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "ki_recommendation_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ki_recommendation_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_recommendation_snapshots: {
        Row: {
          action: string
          created_at: string
          evaluated_at: string | null
          evidence: Json
          id: string
          market_snapshot: Json
          model_version: string
          outcome: Json | null
          plan_id: string | null
          predicted_windows: Json
          trade_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          evaluated_at?: string | null
          evidence: Json
          id?: string
          market_snapshot: Json
          model_version: string
          outcome?: Json | null
          plan_id?: string | null
          predicted_windows?: Json
          trade_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          evaluated_at?: string | null
          evidence?: Json
          id?: string
          market_snapshot?: Json
          model_version?: string
          outcome?: Json | null
          plan_id?: string | null
          predicted_windows?: Json
          trade_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ki_recommendation_snapshots_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ki_position_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ki_recommendation_snapshots_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ki_recommendation_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_strategy_settings: {
        Row: {
          alert_cooldown_minutes: number
          break_even_first: boolean
          enabled_fiats: string[]
          evaluation_amounts: number[]
          live_alerts_enabled: boolean
          muted_until: string | null
          normal_horizon_hours: number
          posture: string
          shadow_mode: boolean
          shadow_started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_cooldown_minutes?: number
          break_even_first?: boolean
          enabled_fiats?: string[]
          evaluation_amounts?: number[]
          live_alerts_enabled?: boolean
          muted_until?: string | null
          normal_horizon_hours?: number
          posture?: string
          shadow_mode?: boolean
          shadow_started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_cooldown_minutes?: number
          break_even_first?: boolean
          enabled_fiats?: string[]
          evaluation_amounts?: number[]
          live_alerts_enabled?: boolean
          muted_until?: string | null
          normal_horizon_hours?: number
          posture?: string
          shadow_mode?: boolean
          shadow_started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ki_strategy_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ki_telegram_updates: {
        Row: {
          error_message: string | null
          processed_at: string | null
          received_at: string
          update_id: number
        }
        Insert: {
          error_message?: string | null
          processed_at?: string | null
          received_at?: string
          update_id: number
        }
        Update: {
          error_message?: string | null
          processed_at?: string | null
          received_at?: string
          update_id?: number
        }
        Relationships: []
      }
      ki_worker_leases: {
        Row: {
          checkpoint: Json
          lease_key: string
          lease_until: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          checkpoint?: Json
          lease_key: string
          lease_until: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          checkpoint?: Json
          lease_key?: string
          lease_until?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_intelligence_ads: {
        Row: {
          asset: string
          available_asset: number | null
          completed_orders: number | null
          completion_rate: number | null
          exchange: string
          external_ad_id: string
          fiat: string
          id: number
          max_fiat: number | null
          merchant_name: string | null
          merchant_verified: boolean | null
          min_fiat: number | null
          observed_at: string
          payment_methods: string[]
          price: number
          raw_fingerprint: string
          response_latency_ms: number | null
          schema_version: string
          side: string
        }
        Insert: {
          asset?: string
          available_asset?: number | null
          completed_orders?: number | null
          completion_rate?: number | null
          exchange: string
          external_ad_id: string
          fiat: string
          id?: never
          max_fiat?: number | null
          merchant_name?: string | null
          merchant_verified?: boolean | null
          min_fiat?: number | null
          observed_at: string
          payment_methods?: string[]
          price: number
          raw_fingerprint: string
          response_latency_ms?: number | null
          schema_version: string
          side: string
        }
        Update: {
          asset?: string
          available_asset?: number | null
          completed_orders?: number | null
          completion_rate?: number | null
          exchange?: string
          external_ad_id?: string
          fiat?: string
          id?: never
          max_fiat?: number | null
          merchant_name?: string | null
          merchant_verified?: boolean | null
          min_fiat?: number | null
          observed_at?: string
          payment_methods?: string[]
          price?: number
          raw_fingerprint?: string
          response_latency_ms?: number | null
          schema_version?: string
          side?: string
        }
        Relationships: []
      }
      market_intelligence_candles: {
        Row: {
          asset: string
          bucket_at: string
          close: number
          depth_asset: number
          exchange: string
          executable_price: number
          fiat: string
          high: number
          id: number
          interval_seconds: number
          low: number
          merchant_count: number
          open: number
          side: string
          volatility: number
        }
        Insert: {
          asset?: string
          bucket_at: string
          close: number
          depth_asset?: number
          exchange: string
          executable_price: number
          fiat: string
          high: number
          id?: never
          interval_seconds: number
          low: number
          merchant_count?: number
          open: number
          side: string
          volatility?: number
        }
        Update: {
          asset?: string
          bucket_at?: string
          close?: number
          depth_asset?: number
          exchange?: string
          executable_price?: number
          fiat?: string
          high?: number
          id?: never
          interval_seconds?: number
          low?: number
          merchant_count?: number
          open?: number
          side?: string
          volatility?: number
        }
        Relationships: []
      }
      market_intelligence_feed_health: {
        Row: {
          consecutive_failures: number
          error_message: string | null
          exchange: string
          fiat: string
          last_failure_at: string | null
          last_success_at: string | null
          latency_ms: number | null
          next_attempt_at: string | null
          schema_version: string | null
          status: string
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          error_message?: string | null
          exchange: string
          fiat: string
          last_failure_at?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          next_attempt_at?: string | null
          schema_version?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          error_message?: string | null
          exchange?: string
          fiat?: string
          last_failure_at?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          next_attempt_at?: string | null
          schema_version?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
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
        Relationships: [
          {
            foreignKeyName: "market_inventory_api_keys_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "market_inventory_audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_capital_ledger: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string
          entry_type: Database["public"]["Enums"]["market_inventory_ledger_entry_type"]
          id: string
          metadata: Json | null
          trade_id: string | null
          trade_type: Database["public"]["Enums"]["market_inventory_trade_type"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description: string
          entry_type: Database["public"]["Enums"]["market_inventory_ledger_entry_type"]
          id?: string
          metadata?: Json | null
          trade_id?: string | null
          trade_type: Database["public"]["Enums"]["market_inventory_trade_type"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string
          entry_type?: Database["public"]["Enums"]["market_inventory_ledger_entry_type"]
          id?: string
          metadata?: Json | null
          trade_id?: string | null
          trade_type?: Database["public"]["Enums"]["market_inventory_trade_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_capital_ledger_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_capital_ledger_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "market_inventory_daily_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "market_inventory_exchange_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_exchange_transactions: {
        Row: {
          account_id: string | null
          amount: number
          asset: string
          created_at: string
          external_tx_id: string
          fee: number | null
          fee_asset: string | null
          from_address: string | null
          id: string
          side: string | null
          status: string
          to_address: string | null
          tx_time: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          asset: string
          created_at?: string
          external_tx_id: string
          fee?: number | null
          fee_asset?: string | null
          from_address?: string | null
          id?: string
          side?: string | null
          status: string
          to_address?: string | null
          tx_time: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          asset?: string
          created_at?: string
          external_tx_id?: string
          fee?: number | null
          fee_asset?: string | null
          from_address?: string | null
          id?: string
          side?: string | null
          status?: string
          to_address?: string | null
          tx_time?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_exchange_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_exchange_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_exchange_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "market_inventory_price_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "market_inventory_risk_alerts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_sync_runs: {
        Row: {
          account_id: string | null
          completed_at: string | null
          error_message: string | null
          exchange: string
          id: string
          metadata: Json | null
          records_failed: number | null
          records_imported: number | null
          started_at: string
          status: Database["public"]["Enums"]["sync_status"]
          user_id: string
        }
        Insert: {
          account_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          exchange: string
          id?: string
          metadata?: Json | null
          records_failed?: number | null
          records_imported?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          user_id: string
        }
        Update: {
          account_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          exchange?: string
          id?: string
          metadata?: Json | null
          records_failed?: number | null
          records_imported?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["sync_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_sync_runs_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_exchange_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_sync_runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_trade_events: {
        Row: {
          created_at: string
          event_type: string
          from_stage: string | null
          id: string
          metadata: Json | null
          to_stage: string | null
          trade_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          trade_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          from_stage?: string | null
          id?: string
          metadata?: Json | null
          to_stage?: string | null
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_trade_events_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_trade_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_trade_fees: {
        Row: {
          amount: number
          created_at: string
          currency: string
          fee_type: string
          id: string
          note: string | null
          trade_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          fee_type?: string
          id?: string
          note?: string | null
          trade_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          fee_type?: string
          id?: string
          note?: string | null
          trade_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_trade_fees_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_trade_fees_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
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
          {
            foreignKeyName: "market_inventory_trade_notes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
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
          available_amount: number | null
          buy_exchange: string
          buy_price: number
          buy_time: string
          closed_amount: number
          confidence_score: number | null
          created_at: string
          currency: string
          destination_exchange: string | null
          duration_minutes: number | null
          entry_fees: number
          estimated_fees: number
          expected_profit: number | null
          expected_sell_price: number | null
          final_fees: number | null
          id: string
          intended_horizon_hours: number
          ki_accuracy_verdict: string | null
          ki_reasoning: string | null
          last_event_at: string
          lesson_learned: string | null
          payment_method: string | null
          realized_profit: number
          remaining_amount: number
          risk_score: number | null
          route: string | null
          sell_exchange: string
          sell_time: string | null
          source_exchange: string | null
          stage: string
          status: Database["public"]["Enums"]["trade_status"]
          total_fiat_spent: number | null
          total_recorded_fees: number
          trade_type: Database["public"]["Enums"]["market_inventory_trade_type"]
          transfer_fee_asset: number
          transfer_network: string | null
          updated_at: string
          user_id: string
          user_notes: string | null
        }
        Insert: {
          actual_profit?: number | null
          actual_sell_price?: number | null
          amount: number
          asset?: string
          available_amount?: number | null
          buy_exchange: string
          buy_price: number
          buy_time?: string
          closed_amount?: number
          confidence_score?: number | null
          created_at?: string
          currency?: string
          destination_exchange?: string | null
          duration_minutes?: number | null
          entry_fees?: number
          estimated_fees?: number
          expected_profit?: number | null
          expected_sell_price?: number | null
          final_fees?: number | null
          id?: string
          intended_horizon_hours?: number
          ki_accuracy_verdict?: string | null
          ki_reasoning?: string | null
          last_event_at?: string
          lesson_learned?: string | null
          payment_method?: string | null
          realized_profit?: number
          remaining_amount: number
          risk_score?: number | null
          route?: string | null
          sell_exchange: string
          sell_time?: string | null
          source_exchange?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["trade_status"]
          total_fiat_spent?: number | null
          total_recorded_fees?: number
          trade_type?: Database["public"]["Enums"]["market_inventory_trade_type"]
          transfer_fee_asset?: number
          transfer_network?: string | null
          updated_at?: string
          user_id: string
          user_notes?: string | null
        }
        Update: {
          actual_profit?: number | null
          actual_sell_price?: number | null
          amount?: number
          asset?: string
          available_amount?: number | null
          buy_exchange?: string
          buy_price?: number
          buy_time?: string
          closed_amount?: number
          confidence_score?: number | null
          created_at?: string
          currency?: string
          destination_exchange?: string | null
          duration_minutes?: number | null
          entry_fees?: number
          estimated_fees?: number
          expected_profit?: number | null
          expected_sell_price?: number | null
          final_fees?: number | null
          id?: string
          intended_horizon_hours?: number
          ki_accuracy_verdict?: string | null
          ki_reasoning?: string | null
          last_event_at?: string
          lesson_learned?: string | null
          payment_method?: string | null
          realized_profit?: number
          remaining_amount?: number
          risk_score?: number | null
          route?: string | null
          sell_exchange?: string
          sell_time?: string | null
          source_exchange?: string | null
          stage?: string
          status?: Database["public"]["Enums"]["trade_status"]
          total_fiat_spent?: number | null
          total_recorded_fees?: number
          trade_type?: Database["public"]["Enums"]["market_inventory_trade_type"]
          transfer_fee_asset?: number
          transfer_network?: string | null
          updated_at?: string
          user_id?: string
          user_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_trades_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      market_inventory_transaction_matches: {
        Row: {
          confidence: number | null
          confirmed_at: string | null
          created_at: string
          deposit_tx_id: string | null
          id: string
          status: string
          trade_id: string | null
          user_id: string
          withdrawal_tx_id: string | null
        }
        Insert: {
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          deposit_tx_id?: string | null
          id?: string
          status?: string
          trade_id?: string | null
          user_id: string
          withdrawal_tx_id?: string | null
        }
        Update: {
          confidence?: number | null
          confirmed_at?: string | null
          created_at?: string
          deposit_tx_id?: string | null
          id?: string
          status?: string
          trade_id?: string | null
          user_id?: string
          withdrawal_tx_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_inventory_transaction_matches_deposit_tx_id_fkey"
            columns: ["deposit_tx_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_exchange_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_transaction_matches_trade_id_fkey"
            columns: ["trade_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_trades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_transaction_matches_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_inventory_transaction_matches_withdrawal_tx_id_fkey"
            columns: ["withdrawal_tx_id"]
            isOneToOne: false
            referencedRelation: "market_inventory_exchange_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_connections: {
        Row: {
          chat_id: number | null
          created_at: string
          enabled: boolean
          id: string
          link_code_expires_at: string | null
          link_code_hash: string | null
          linked_at: string | null
          telegram_user_id: number | null
          user_id: string
        }
        Insert: {
          chat_id?: number | null
          created_at?: string
          enabled?: boolean
          id?: string
          link_code_expires_at?: string | null
          link_code_hash?: string | null
          linked_at?: string | null
          telegram_user_id?: number | null
          user_id: string
        }
        Update: {
          chat_id?: number | null
          created_at?: string
          enabled?: boolean
          id?: string
          link_code_expires_at?: string | null
          link_code_hash?: string | null
          linked_at?: string | null
          telegram_user_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "app_users"
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "app_users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_smai_id: { Args: never; Returns: string }
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
      market_inventory_ledger_entry_type:
        | "paper_position_opened"
        | "paper_realized_profit"
        | "manual_capital_committed"
        | "manual_realized_profit"
        | "fee_recorded"
        | "adjustment"
      market_inventory_trade_type: "paper" | "manual"
      sync_status: "running" | "completed" | "failed"
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
      market_inventory_ledger_entry_type: [
        "paper_position_opened",
        "paper_realized_profit",
        "manual_capital_committed",
        "manual_realized_profit",
        "fee_recorded",
        "adjustment",
      ],
      market_inventory_trade_type: ["paper", "manual"],
      sync_status: ["running", "completed", "failed"],
      trade_status: ["active", "closed", "cancelled"],
    },
  },
} as const

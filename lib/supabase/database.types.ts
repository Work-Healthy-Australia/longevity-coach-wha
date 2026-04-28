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
  agents: {
    Tables: {
      agent_conversations: {
        Row: {
          agent: string
          content: string
          created_at: string
          id: string
          role: string
          user_uuid: string
        }
        Insert: {
          agent: string
          content: string
          created_at?: string
          id?: string
          role: string
          user_uuid: string
        }
        Update: {
          agent?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_uuid?: string
        }
        Relationships: []
      }
      agent_definitions: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          enabled: boolean
          id: string
          max_tokens: number
          mcp_servers: Json
          model: string
          provider: string
          slug: string
          system_prompt: string
          temperature: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          enabled?: boolean
          id?: string
          max_tokens?: number
          mcp_servers?: Json
          model?: string
          provider?: string
          slug: string
          system_prompt: string
          temperature?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          enabled?: boolean
          id?: string
          max_tokens?: number
          mcp_servers?: Json
          model?: string
          provider?: string
          slug?: string
          system_prompt?: string
          temperature?: number
          updated_at?: string
        }
        Relationships: []
      }
      health_knowledge: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          fts: unknown
          id: string
          metadata: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          fts?: unknown
          id?: string
          metadata?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          fts?: unknown
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  billing: {
    Tables: {
      organisation_addons: {
        Row: {
          enabled_at: string
          org_id: string
          plan_addon_id: string
        }
        Insert: {
          enabled_at?: string
          org_id: string
          plan_addon_id: string
        }
        Update: {
          enabled_at?: string
          org_id?: string
          plan_addon_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_addons_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organisation_addons_plan_addon_id_fkey"
            columns: ["plan_addon_id"]
            isOneToOne: false
            referencedRelation: "plan_addons"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          joined_at: string
          org_id: string
          role: string
          user_uuid: string
        }
        Insert: {
          joined_at?: string
          org_id: string
          role?: string
          user_uuid: string
        }
        Update: {
          joined_at?: string
          org_id?: string
          role?: string
          user_uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan_id: string | null
          seat_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan_id?: string | null
          seat_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan_id?: string | null
          seat_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisations_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_addons: {
        Row: {
          created_at: string
          description: string | null
          feature_key: string
          id: string
          is_active: boolean
          min_tier: string
          name: string
          price_annual_cents: number
          price_monthly_cents: number
          stripe_price_id_annual: string
          stripe_price_id_monthly: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          feature_key: string
          id?: string
          is_active?: boolean
          min_tier: string
          name: string
          price_annual_cents: number
          price_monthly_cents: number
          stripe_price_id_annual: string
          stripe_price_id_monthly: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          feature_key?: string
          id?: string
          is_active?: boolean
          min_tier?: string
          name?: string
          price_annual_cents?: number
          price_monthly_cents?: number
          stripe_price_id_annual?: string
          stripe_price_id_monthly?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          annual_discount_pct: number
          base_price_cents: number
          billing_interval: string
          created_at: string
          feature_flags: Json
          id: string
          is_active: boolean
          name: string
          stripe_price_id: string
          tier: string
          updated_at: string
        }
        Insert: {
          annual_discount_pct?: number
          base_price_cents: number
          billing_interval: string
          created_at?: string
          feature_flags?: Json
          id?: string
          is_active?: boolean
          name: string
          stripe_price_id: string
          tier: string
          updated_at?: string
        }
        Update: {
          annual_discount_pct?: number
          base_price_cents?: number
          billing_interval?: string
          created_at?: string
          feature_flags?: Json
          id?: string
          is_active?: boolean
          name?: string
          stripe_price_id?: string
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          product_code: string
          retail_cents: number
          stripe_price_id: string | null
          supplier_id: string
          updated_at: string
          wholesale_cents: number
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          product_code: string
          retail_cents: number
          stripe_price_id?: string | null
          supplier_id: string
          updated_at?: string
          wholesale_cents: number
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          product_code?: string
          retail_cents?: number
          stripe_price_id?: string | null
          supplier_id?: string
          updated_at?: string
          wholesale_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_addons: {
        Row: {
          created_at: string
          id: string
          plan_addon_id: string
          status: string
          stripe_subscription_id: string
          stripe_subscription_item_id: string
          updated_at: string
          user_uuid: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_addon_id: string
          status?: string
          stripe_subscription_id: string
          stripe_subscription_item_id: string
          updated_at?: string
          user_uuid: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_addon_id?: string
          status?: string
          stripe_subscription_id?: string
          stripe_subscription_item_id?: string
          updated_at?: string
          user_uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_addons_plan_addon_id_fkey"
            columns: ["plan_addon_id"]
            isOneToOne: false
            referencedRelation: "plan_addons"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          external_identifier: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          external_identifier?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          external_identifier?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      test_orders: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          notes: string | null
          product_id: string
          status: string
          stripe_payment_intent_id: string | null
          updated_at: string
          user_uuid: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_uuid: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          updated_at?: string
          user_uuid?: string
        }
        Relationships: [
          {
            foreignKeyName: "test_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "test_orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      products_public: {
        Row: {
          category: string | null
          description: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          product_code: string | null
          retail_cents: number | null
          stripe_price_id: string | null
          supplier_id: string | null
        }
        Insert: {
          category?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          product_code?: string | null
          retail_cents?: number | null
          stripe_price_id?: string | null
          supplier_id?: string | null
        }
        Update: {
          category?: string | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          product_code?: string | null
          retail_cents?: number | null
          stripe_price_id?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  biomarkers: {
    Tables: {
      biological_age_tests: {
        Row: {
          biological_age: number
          created_at: string
          elevated_markers: number | null
          id: string
          key_insights: string[]
          notes: string | null
          optimal_markers: number | null
          report_url: string | null
          suboptimal_markers: number | null
          test_date: string
          test_method: string | null
          test_provider: string | null
          total_markers: number | null
          upload_id: string | null
          user_uuid: string
        }
        Insert: {
          biological_age: number
          created_at?: string
          elevated_markers?: number | null
          id?: string
          key_insights?: string[]
          notes?: string | null
          optimal_markers?: number | null
          report_url?: string | null
          suboptimal_markers?: number | null
          test_date: string
          test_method?: string | null
          test_provider?: string | null
          total_markers?: number | null
          upload_id?: string | null
          user_uuid: string
        }
        Update: {
          biological_age?: number
          created_at?: string
          elevated_markers?: number | null
          id?: string
          key_insights?: string[]
          notes?: string | null
          optimal_markers?: number | null
          report_url?: string | null
          suboptimal_markers?: number | null
          test_date?: string
          test_method?: string | null
          test_provider?: string | null
          total_markers?: number | null
          upload_id?: string | null
          user_uuid?: string
        }
        Relationships: []
      }
      daily_logs: {
        Row: {
          blood_pressure_diastolic: number | null
          blood_pressure_systolic: number | null
          bowel_movements: number | null
          bowel_quality: string | null
          created_at: string
          energy_level: number | null
          gut_health: number | null
          hrv: number | null
          id: string
          log_date: string
          meals_consumed: Json | null
          meditation_completed: boolean | null
          meditation_duration_min: number | null
          mobility_completed: boolean | null
          mobility_duration_min: number | null
          mood: number | null
          notes: string | null
          protein_grams: number | null
          resting_heart_rate: number | null
          sauna_completed: boolean | null
          sauna_rounds: number | null
          sleep_hours: number | null
          sleep_quality: number | null
          steps: number | null
          strength_notes: string | null
          stress_level: number | null
          supplements_taken: string[]
          updated_at: string
          user_uuid: string
          water_ml: number | null
          weight_kg: number | null
          workout_completed: boolean | null
          workout_duration_min: number | null
          workout_intensity: number | null
          workout_type: string | null
        }
        Insert: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          bowel_movements?: number | null
          bowel_quality?: string | null
          created_at?: string
          energy_level?: number | null
          gut_health?: number | null
          hrv?: number | null
          id?: string
          log_date: string
          meals_consumed?: Json | null
          meditation_completed?: boolean | null
          meditation_duration_min?: number | null
          mobility_completed?: boolean | null
          mobility_duration_min?: number | null
          mood?: number | null
          notes?: string | null
          protein_grams?: number | null
          resting_heart_rate?: number | null
          sauna_completed?: boolean | null
          sauna_rounds?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          steps?: number | null
          strength_notes?: string | null
          stress_level?: number | null
          supplements_taken?: string[]
          updated_at?: string
          user_uuid: string
          water_ml?: number | null
          weight_kg?: number | null
          workout_completed?: boolean | null
          workout_duration_min?: number | null
          workout_intensity?: number | null
          workout_type?: string | null
        }
        Update: {
          blood_pressure_diastolic?: number | null
          blood_pressure_systolic?: number | null
          bowel_movements?: number | null
          bowel_quality?: string | null
          created_at?: string
          energy_level?: number | null
          gut_health?: number | null
          hrv?: number | null
          id?: string
          log_date?: string
          meals_consumed?: Json | null
          meditation_completed?: boolean | null
          meditation_duration_min?: number | null
          mobility_completed?: boolean | null
          mobility_duration_min?: number | null
          mood?: number | null
          notes?: string | null
          protein_grams?: number | null
          resting_heart_rate?: number | null
          sauna_completed?: boolean | null
          sauna_rounds?: number | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          steps?: number | null
          strength_notes?: string | null
          stress_level?: number | null
          supplements_taken?: string[]
          updated_at?: string
          user_uuid?: string
          water_ml?: number | null
          weight_kg?: number | null
          workout_completed?: boolean | null
          workout_duration_min?: number | null
          workout_intensity?: number | null
          workout_type?: string | null
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          biomarker: string
          category: string | null
          created_at: string
          id: string
          lab_provider: string | null
          notes: string | null
          optimal_max: number | null
          optimal_min: number | null
          panel_name: string | null
          reference_max: number | null
          reference_min: number | null
          status: string | null
          test_date: string
          trend: string | null
          unit: string
          upload_id: string | null
          user_uuid: string
          value: number
        }
        Insert: {
          biomarker: string
          category?: string | null
          created_at?: string
          id?: string
          lab_provider?: string | null
          notes?: string | null
          optimal_max?: number | null
          optimal_min?: number | null
          panel_name?: string | null
          reference_max?: number | null
          reference_min?: number | null
          status?: string | null
          test_date: string
          trend?: string | null
          unit: string
          upload_id?: string | null
          user_uuid: string
          value: number
        }
        Update: {
          biomarker?: string
          category?: string | null
          created_at?: string
          id?: string
          lab_provider?: string | null
          notes?: string | null
          optimal_max?: number | null
          optimal_min?: number | null
          panel_name?: string | null
          reference_max?: number | null
          reference_min?: number | null
          status?: string | null
          test_date?: string
          trend?: string | null
          unit?: string
          upload_id?: string | null
          user_uuid?: string
          value?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_type: string
          clinician_uuid: string | null
          conversation_ref: string | null
          created_at: string
          duration_minutes: number
          id: string
          notes: string | null
          patient_uuid: string
          scheduled_at: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_type: string
          clinician_uuid?: string | null
          conversation_ref?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_uuid: string
          scheduled_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_type?: string
          clinician_uuid?: string | null
          conversation_ref?: string | null
          created_at?: string
          duration_minutes?: number
          id?: string
          notes?: string | null
          patient_uuid?: string
          scheduled_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      care_notes: {
        Row: {
          author_role: string
          author_uuid: string | null
          content: string
          created_at: string
          follow_up_date: string | null
          id: string
          is_visible_to_patient: boolean
          note_type: string
          patient_uuid: string
          priority: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          author_role: string
          author_uuid?: string | null
          content: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          is_visible_to_patient?: boolean
          note_type: string
          patient_uuid: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          author_role?: string
          author_uuid?: string | null
          content?: string
          created_at?: string
          follow_up_date?: string | null
          id?: string
          is_visible_to_patient?: boolean
          note_type?: string
          patient_uuid?: string
          priority?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      coach_suggestions: {
        Row: {
          completed_at: string | null
          created_at: string
          data_target: string | null
          dismissed_at: string | null
          estimated_cost_aud: number | null
          expected_insight: string | null
          id: string
          is_completed: boolean
          is_dismissed: boolean
          patient_uuid: string
          priority: number
          rationale: string | null
          suggested_provider: string | null
          suggestion_type: string
          title: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          data_target?: string | null
          dismissed_at?: string | null
          estimated_cost_aud?: number | null
          expected_insight?: string | null
          id?: string
          is_completed?: boolean
          is_dismissed?: boolean
          patient_uuid: string
          priority?: number
          rationale?: string | null
          suggested_provider?: string | null
          suggestion_type: string
          title: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          data_target?: string | null
          dismissed_at?: string | null
          estimated_cost_aud?: number | null
          expected_insight?: string | null
          id?: string
          is_completed?: boolean
          is_dismissed?: boolean
          patient_uuid?: string
          priority?: number
          rationale?: string | null
          suggested_provider?: string | null
          suggestion_type?: string
          title?: string
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          accepted_at: string
          created_at: string
          id: string
          ip_address: string | null
          policy_id: string
          policy_version: string
          user_agent: string | null
          user_uuid: string
        }
        Insert: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          policy_id: string
          policy_version: string
          user_agent?: string | null
          user_uuid: string
        }
        Update: {
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          policy_id?: string
          policy_version?: string
          user_agent?: string | null
          user_uuid?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          age_at_death: number | null
          alcohol_use: string | null
          cause_category: string | null
          conditions: string[]
          created_at: string
          current_age: number | null
          id: string
          is_alive: boolean
          notes: string | null
          relationship: string
          sex: string | null
          smoking_status: string | null
          updated_at: string
          user_uuid: string
        }
        Insert: {
          age_at_death?: number | null
          alcohol_use?: string | null
          cause_category?: string | null
          conditions?: string[]
          created_at?: string
          current_age?: number | null
          id?: string
          is_alive: boolean
          notes?: string | null
          relationship: string
          sex?: string | null
          smoking_status?: string | null
          updated_at?: string
          user_uuid: string
        }
        Update: {
          age_at_death?: number | null
          alcohol_use?: string | null
          cause_category?: string | null
          conditions?: string[]
          created_at?: string
          current_age?: number | null
          id?: string
          is_alive?: boolean
          notes?: string | null
          relationship?: string
          sex?: string | null
          smoking_status?: string | null
          updated_at?: string
          user_uuid?: string
        }
        Relationships: []
      }
      health_profiles: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          responses: Json
          updated_at: string
          user_uuid: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          responses?: Json
          updated_at?: string
          user_uuid: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          responses?: Json
          updated_at?: string
          user_uuid?: string
        }
        Relationships: []
      }
      health_updates: {
        Row: {
          category: string
          content: string
          created_at: string
          evidence_level: string
          id: string
          posted_date: string
          source: string
          title: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          evidence_level: string
          id?: string
          posted_date?: string
          source: string
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          evidence_level?: string
          id?: string
          posted_date?: string
          source?: string
          title?: string
        }
        Relationships: []
      }
      meal_plans: {
        Row: {
          calorie_target: number | null
          created_at: string
          created_by_role: string
          created_by_uuid: string | null
          dietary_restrictions: string[]
          id: string
          macros_target: Json | null
          meal_structure: Json | null
          notes: string | null
          patient_uuid: string
          review_id: string | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          calorie_target?: number | null
          created_at?: string
          created_by_role: string
          created_by_uuid?: string | null
          dietary_restrictions?: string[]
          id?: string
          macros_target?: Json | null
          meal_structure?: Json | null
          notes?: string | null
          patient_uuid: string
          review_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          calorie_target?: number | null
          created_at?: string
          created_by_role?: string
          created_by_uuid?: string | null
          dietary_restrictions?: string[]
          id?: string
          macros_target?: Json | null
          meal_structure?: Json | null
          notes?: string | null
          patient_uuid?: string
          review_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "periodic_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_assignments: {
        Row: {
          assigned_at: string
          clinician_uuid: string | null
          coach_uuid: string | null
          created_at: string
          id: string
          org_id: string | null
          patient_uuid: string
          status: string
        }
        Insert: {
          assigned_at?: string
          clinician_uuid?: string | null
          coach_uuid?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          patient_uuid: string
          status?: string
        }
        Update: {
          assigned_at?: string
          clinician_uuid?: string | null
          coach_uuid?: string | null
          created_at?: string
          id?: string
          org_id?: string | null
          patient_uuid?: string
          status?: string
        }
        Relationships: []
      }
      patient_uploads: {
        Row: {
          created_at: string
          file_size_bytes: number
          id: string
          janet_category: string | null
          janet_error: string | null
          janet_findings: Json | null
          janet_processed_at: string | null
          janet_status: string
          janet_summary: string | null
          mime_type: string
          original_filename: string
          storage_path: string
          updated_at: string
          user_uuid: string
        }
        Insert: {
          created_at?: string
          file_size_bytes: number
          id?: string
          janet_category?: string | null
          janet_error?: string | null
          janet_findings?: Json | null
          janet_processed_at?: string | null
          janet_status?: string
          janet_summary?: string | null
          mime_type: string
          original_filename: string
          storage_path: string
          updated_at?: string
          user_uuid: string
        }
        Update: {
          created_at?: string
          file_size_bytes?: number
          id?: string
          janet_category?: string | null
          janet_error?: string | null
          janet_findings?: Json | null
          janet_processed_at?: string | null
          janet_status?: string
          janet_summary?: string | null
          mime_type?: string
          original_filename?: string
          storage_path?: string
          updated_at?: string
          user_uuid?: string
        }
        Relationships: []
      }
      periodic_reviews: {
        Row: {
          adherence_notes: string | null
          adherence_score: number | null
          ai_processed_at: string | null
          ai_summary: string | null
          approved_at: string | null
          clinician_notes: string | null
          clinician_uuid: string | null
          created_at: string
          delivery_method: string | null
          id: string
          next_goals: string[]
          open_space: string | null
          overall_sentiment: string | null
          patient_submitted_at: string | null
          patient_uuid: string
          review_date: string
          review_type: string
          status: string
          stress_level: number | null
          stress_notes: string | null
          support_needed: string | null
          updated_at: string
          wins: string[]
        }
        Insert: {
          adherence_notes?: string | null
          adherence_score?: number | null
          ai_processed_at?: string | null
          ai_summary?: string | null
          approved_at?: string | null
          clinician_notes?: string | null
          clinician_uuid?: string | null
          created_at?: string
          delivery_method?: string | null
          id?: string
          next_goals?: string[]
          open_space?: string | null
          overall_sentiment?: string | null
          patient_submitted_at?: string | null
          patient_uuid: string
          review_date: string
          review_type: string
          status?: string
          stress_level?: number | null
          stress_notes?: string | null
          support_needed?: string | null
          updated_at?: string
          wins?: string[]
        }
        Update: {
          adherence_notes?: string | null
          adherence_score?: number | null
          ai_processed_at?: string | null
          ai_summary?: string | null
          approved_at?: string | null
          clinician_notes?: string | null
          clinician_uuid?: string | null
          created_at?: string
          delivery_method?: string | null
          id?: string
          next_goals?: string[]
          open_space?: string | null
          overall_sentiment?: string | null
          patient_submitted_at?: string | null
          patient_uuid?: string
          review_date?: string
          review_type?: string
          status?: string
          stress_level?: number | null
          stress_notes?: string | null
          support_needed?: string | null
          updated_at?: string
          wins?: string[]
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address_postal: string | null
          created_at: string
          date_of_birth: string | null
          drip_day1_sent_at: string | null
          drip_day3_sent_at: string | null
          drip_day7_sent_at: string | null
          full_name: string | null
          id: string
          is_admin: boolean
          phone: string | null
          role: string
          updated_at: string
        }
        Insert: {
          address_postal?: string | null
          created_at?: string
          date_of_birth?: string | null
          drip_day1_sent_at?: string | null
          drip_day3_sent_at?: string | null
          drip_day7_sent_at?: string | null
          full_name?: string | null
          id: string
          is_admin?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          address_postal?: string | null
          created_at?: string
          date_of_birth?: string | null
          drip_day1_sent_at?: string | null
          drip_day3_sent_at?: string | null
          drip_day7_sent_at?: string | null
          full_name?: string | null
          id?: string
          is_admin?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      risk_assessment_standards: {
        Row: {
          active: boolean
          applicable_age_max: number | null
          applicable_age_min: number | null
          applicable_sex: string | null
          clinical_guidance: string | null
          clinical_threshold: string | null
          created_at: string
          domain: string
          evidence_level: string
          framework_name: string
          id: string
          internal_score_max: number | null
          internal_score_min: number | null
          key_risk_factors: Json
          notes: string | null
          protective_factors: Json
          risk_tier: string
          source_citation: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          applicable_age_max?: number | null
          applicable_age_min?: number | null
          applicable_sex?: string | null
          clinical_guidance?: string | null
          clinical_threshold?: string | null
          created_at?: string
          domain: string
          evidence_level: string
          framework_name: string
          id?: string
          internal_score_max?: number | null
          internal_score_min?: number | null
          key_risk_factors?: Json
          notes?: string | null
          protective_factors?: Json
          risk_tier: string
          source_citation: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          applicable_age_max?: number | null
          applicable_age_min?: number | null
          applicable_sex?: string | null
          clinical_guidance?: string | null
          clinical_threshold?: string | null
          created_at?: string
          domain?: string
          evidence_level?: string
          framework_name?: string
          id?: string
          internal_score_max?: number | null
          internal_score_min?: number | null
          key_risk_factors?: Json
          notes?: string | null
          protective_factors?: Json
          risk_tier?: string
          source_citation?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      risk_scores: {
        Row: {
          assessment_date: string | null
          biological_age: number | null
          cancer_risk: number | null
          composite_risk: number | null
          computed_at: string
          confidence_level: string | null
          cv_risk: number | null
          data_completeness: number | null
          data_gaps: string[]
          domain_scores: Json | null
          engine_output: Json | null
          family_history_summary: string | null
          id: string
          longevity_label: string | null
          longevity_score: number | null
          metabolic_risk: number | null
          msk_risk: number | null
          narrative: string | null
          neuro_risk: number | null
          next_recommended_tests: string | null
          onco_risk: number | null
          recommended_screenings: string[]
          risk_level: string | null
          top_protective_levers: string[]
          top_risk_drivers: string[]
          trajectory_6month: Json | null
          user_uuid: string
        }
        Insert: {
          assessment_date?: string | null
          biological_age?: number | null
          cancer_risk?: number | null
          composite_risk?: number | null
          computed_at?: string
          confidence_level?: string | null
          cv_risk?: number | null
          data_completeness?: number | null
          data_gaps?: string[]
          domain_scores?: Json | null
          engine_output?: Json | null
          family_history_summary?: string | null
          id?: string
          longevity_label?: string | null
          longevity_score?: number | null
          metabolic_risk?: number | null
          msk_risk?: number | null
          narrative?: string | null
          neuro_risk?: number | null
          next_recommended_tests?: string | null
          onco_risk?: number | null
          recommended_screenings?: string[]
          risk_level?: string | null
          top_protective_levers?: string[]
          top_risk_drivers?: string[]
          trajectory_6month?: Json | null
          user_uuid: string
        }
        Update: {
          assessment_date?: string | null
          biological_age?: number | null
          cancer_risk?: number | null
          composite_risk?: number | null
          computed_at?: string
          confidence_level?: string | null
          cv_risk?: number | null
          data_completeness?: number | null
          data_gaps?: string[]
          domain_scores?: Json | null
          engine_output?: Json | null
          family_history_summary?: string | null
          id?: string
          longevity_label?: string | null
          longevity_score?: number | null
          metabolic_risk?: number | null
          msk_risk?: number | null
          narrative?: string | null
          neuro_risk?: number | null
          next_recommended_tests?: string | null
          onco_risk?: number | null
          recommended_screenings?: string[]
          risk_level?: string | null
          top_protective_levers?: string[]
          top_risk_drivers?: string[]
          trajectory_6month?: Json | null
          user_uuid?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          price_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_uuid: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_uuid: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          price_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_uuid?: string
        }
        Relationships: []
      }
      supplement_catalog: {
        Row: {
          canonical_dose: string
          contraindicates: Json
          cost_aud_month: number | null
          created_at: string
          display_name: string
          domain: string
          evidence_tag: string
          id: string
          notes: string | null
          sku: string
          supplier_sku_au: string | null
          timing_default: string | null
          triggers_when: Json
        }
        Insert: {
          canonical_dose: string
          contraindicates?: Json
          cost_aud_month?: number | null
          created_at?: string
          display_name: string
          domain: string
          evidence_tag: string
          id?: string
          notes?: string | null
          sku: string
          supplier_sku_au?: string | null
          timing_default?: string | null
          triggers_when?: Json
        }
        Update: {
          canonical_dose?: string
          contraindicates?: Json
          cost_aud_month?: number | null
          created_at?: string
          display_name?: string
          domain?: string
          evidence_tag?: string
          id?: string
          notes?: string | null
          sku?: string
          supplier_sku_au?: string | null
          timing_default?: string | null
          triggers_when?: Json
        }
        Relationships: []
      }
      supplement_plans: {
        Row: {
          created_at: string
          created_by_role: string
          created_by_uuid: string | null
          id: string
          items: Json
          notes: string | null
          patient_uuid: string
          review_id: string | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by_role: string
          created_by_uuid?: string | null
          id?: string
          items?: Json
          notes?: string | null
          patient_uuid: string
          review_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by_role?: string
          created_by_uuid?: string | null
          id?: string
          items?: Json
          notes?: string | null
          patient_uuid?: string
          review_id?: string | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplement_plans_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "periodic_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          conversation_ref: string | null
          created_at: string
          id: string
          persona: string
          status: string
          summary: string
          updated_at: string
          user_uuid: string
        }
        Insert: {
          category: string
          conversation_ref?: string | null
          created_at?: string
          id?: string
          persona: string
          status?: string
          summary: string
          updated_at?: string
          user_uuid: string
        }
        Update: {
          category?: string
          conversation_ref?: string | null
          created_at?: string
          id?: string
          persona?: string
          status?: string
          summary?: string
          updated_at?: string
          user_uuid?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string
          created_by_role: string
          created_by_uuid: string | null
          id: string
          notes: string | null
          patient_uuid: string
          review_id: string | null
          sessions: Json
          sessions_per_week: number | null
          status: string
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by_role: string
          created_by_uuid?: string | null
          id?: string
          notes?: string | null
          patient_uuid: string
          review_id?: string | null
          sessions?: Json
          sessions_per_week?: number | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by_role?: string
          created_by_uuid?: string | null
          id?: string
          notes?: string | null
          patient_uuid?: string
          review_id?: string | null
          sessions?: Json
          sessions_per_week?: number | null
          status?: string
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "periodic_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      hybrid_search_health:
        | {
            Args: {
              match_count?: number
              query_text: string
              query_vec?: string
            }
            Returns: {
              category: string
              content: string
              id: string
              rank: number
            }[]
          }
        | {
            Args: {
              kw_weight?: number
              match_count?: number
              query_text: string
              query_vec?: string
              sem_weight?: number
            }
            Returns: {
              content: string
              id: string
              metadata: Json
              score: number
            }[]
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
  agents: {
    Enums: {},
  },
  billing: {
    Enums: {},
  },
  biomarkers: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

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
      active_players: {
        Row: {
          last_seen: string
          map_id: string | null
          user_id: string
          x: number
          y: number
        }
        Insert: {
          last_seen?: string
          map_id?: string | null
          user_id: string
          x?: number
          y?: number
        }
        Update: {
          last_seen?: string
          map_id?: string | null
          user_id?: string
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "active_players_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          active: boolean
          asset_type: string
          category: string | null
          created_at: string
          file_format: string | null
          file_url: string
          height: number | null
          id: string
          name: string
          tags: string[] | null
          thumbnail_url: string | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          active?: boolean
          asset_type: string
          category?: string | null
          created_at?: string
          file_format?: string | null
          file_url: string
          height?: number | null
          id?: string
          name: string
          tags?: string[] | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          active?: boolean
          asset_type?: string
          category?: string | null
          created_at?: string
          file_format?: string | null
          file_url?: string
          height?: number | null
          id?: string
          name?: string
          tags?: string[] | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      auction_bids: {
        Row: {
          amount: number
          auction_id: string
          created_at: string
          id: string
          refunded: boolean
          user_id: string
        }
        Insert: {
          amount: number
          auction_id: string
          created_at?: string
          id?: string
          refunded?: boolean
          user_id: string
        }
        Update: {
          amount?: number
          auction_id?: string
          created_at?: string
          id?: string
          refunded?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_auction_id_fkey"
            columns: ["auction_id"]
            isOneToOne: false
            referencedRelation: "auctions"
            referencedColumns: ["id"]
          },
        ]
      }
      auctions: {
        Row: {
          active: boolean
          bid_increment: number
          created_at: string
          current_bid: number | null
          current_leader: string | null
          description: string | null
          ends_at: string | null
          gallery: Json
          id: string
          image_url: string | null
          name: string
          product_ids: string[]
          settled_at: string | null
          starting_price: number
          starts_at: string
          status: string
          store_id: string | null
          updated_at: string
          winner_id: string | null
        }
        Insert: {
          active?: boolean
          bid_increment?: number
          created_at?: string
          current_bid?: number | null
          current_leader?: string | null
          description?: string | null
          ends_at?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          name: string
          product_ids?: string[]
          settled_at?: string | null
          starting_price?: number
          starts_at?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Update: {
          active?: boolean
          bid_increment?: number
          created_at?: string
          current_bid?: number | null
          current_leader?: string | null
          description?: string | null
          ends_at?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          name?: string
          product_ids?: string[]
          settled_at?: string | null
          starting_price?: number
          starts_at?: string
          status?: string
          store_id?: string | null
          updated_at?: string
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auctions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          admin_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          previous_value: Json | null
          reason: string | null
        }
        Insert: {
          action_type: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Update: {
          action_type?: string
          admin_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_user_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          blocked_user_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          blocked_user_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      character_roles: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          display_order: number
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          active: boolean
          created_at: string
          credit_price: number
          description: string | null
          display_order: number
          id: string
          image_url: string | null
          is_free: boolean
          is_starter: boolean
          model_3d_url: string | null
          name: string
          role_id: string | null
          sprite_jump_url: string | null
          sprite_left_url: string | null
          sprite_right_url: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credit_price?: number
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_free?: boolean
          is_starter?: boolean
          model_3d_url?: string | null
          name: string
          role_id?: string | null
          sprite_jump_url?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credit_price?: number
          description?: string | null
          display_order?: number
          id?: string
          image_url?: string | null
          is_free?: boolean
          is_starter?: boolean
          model_3d_url?: string | null
          name?: string
          role_id?: string | null
          sprite_jump_url?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "character_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel: string
          created_at: string
          deleted: boolean
          deleted_by: string | null
          id: string
          message: string
          recipient_id: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          deleted?: boolean
          deleted_by?: string | null
          id?: string
          message: string
          recipient_id?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          deleted?: boolean
          deleted_by?: string | null
          id?: string
          message?: string
          recipient_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      clues: {
        Row: {
          active: boolean
          available_in_wheel: boolean
          body: string | null
          box_id: string | null
          created_at: string
          id: string
          image_url: string | null
          name: string
          price_credits: number
          step_order: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          available_in_wheel?: boolean
          body?: string | null
          box_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name: string
          price_credits?: number
          step_order?: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          available_in_wheel?: boolean
          body?: string | null
          box_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          price_credits?: number
          step_order?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clues_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "treasure_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "store_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cosmetic_categories: {
        Row: {
          active: boolean
          id: string
          layer_order: number
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          id?: string
          layer_order?: number
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          id?: string
          layer_order?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      cosmetics: {
        Row: {
          active: boolean
          category_id: string | null
          color_hex: string | null
          compatibility: Json
          created_at: string
          credit_price: number
          display_order: number
          end_date: string | null
          id: string
          image_url: string | null
          is_free: boolean
          is_starter: boolean
          layer_order: number
          layer_type: string
          limited_edition: boolean
          model_3d_url: string | null
          name: string
          offset_x: number
          offset_y: number
          quest_requirement: string | null
          rarity: string | null
          required_level: number
          scale: number
          slug: string | null
          sprite_left_url: string | null
          sprite_right_url: string | null
          start_date: string | null
          store_id: string | null
          thumbnail_url: string | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          color_hex?: string | null
          compatibility?: Json
          created_at?: string
          credit_price?: number
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          is_starter?: boolean
          layer_order?: number
          layer_type: string
          limited_edition?: boolean
          model_3d_url?: string | null
          name: string
          offset_x?: number
          offset_y?: number
          quest_requirement?: string | null
          rarity?: string | null
          required_level?: number
          scale?: number
          slug?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          start_date?: string | null
          store_id?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          color_hex?: string | null
          compatibility?: Json
          created_at?: string
          credit_price?: number
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_free?: boolean
          is_starter?: boolean
          layer_order?: number
          layer_type?: string
          limited_edition?: boolean
          model_3d_url?: string | null
          name?: string
          offset_x?: number
          offset_y?: number
          quest_requirement?: string | null
          rarity?: string | null
          required_level?: number
          scale?: number
          slug?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          start_date?: string | null
          store_id?: string | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cosmetics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "cosmetic_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cosmetics_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packages: {
        Row: {
          active: boolean
          bonus_credits: number
          created_at: string
          credit_amount: number
          currency: string
          description: string | null
          display_order: number
          emoji: string | null
          featured: boolean
          id: string
          meshulam_page_url: string | null
          name: string
          price: number
        }
        Insert: {
          active?: boolean
          bonus_credits?: number
          created_at?: string
          credit_amount: number
          currency?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          featured?: boolean
          id?: string
          meshulam_page_url?: string | null
          name: string
          price: number
        }
        Update: {
          active?: boolean
          bonus_credits?: number
          created_at?: string
          credit_amount?: number
          currency?: string
          description?: string | null
          display_order?: number
          emoji?: string | null
          featured?: boolean
          id?: string
          meshulam_page_url?: string | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          admin_id: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          description: string | null
          id: string
          related_cosmetic: string | null
          related_order: string | null
          related_product: string | null
          related_quest: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          admin_id?: string | null
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          description?: string | null
          id?: string
          related_cosmetic?: string | null
          related_order?: string | null
          related_product?: string | null
          related_quest?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          admin_id?: string | null
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          description?: string | null
          id?: string
          related_cosmetic?: string | null
          related_order?: string | null
          related_product?: string | null
          related_quest?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_transactions_related_cosmetic_fkey"
            columns: ["related_cosmetic"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_related_order_fkey"
            columns: ["related_order"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_related_product_fkey"
            columns: ["related_product"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_transactions_related_quest_fkey"
            columns: ["related_quest"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verifications: {
        Row: {
          attempts: number
          code: string
          created_at: string
          expires_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          code: string
          created_at?: string
          expires_at: string
          user_id: string
        }
        Update: {
          attempts?: number
          code?: string
          created_at?: string
          expires_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_settings: {
        Row: {
          credit_purchasing_enabled: boolean
          current_event: string | null
          default_map_id: string | null
          email_verification_required: boolean
          extra: Json
          favicon_url: string | null
          game_name: string
          global_announcement: string | null
          gravity: number
          id: number
          jump_strength: number
          logo_url: string | null
          maintenance_mode: boolean
          max_username_length: number
          movement_speed: number
          music_volume: number
          pickup_address: string | null
          quest_timezone: string
          registration_enabled: boolean
          shipping_gems_cost: number
          sound_volume: number
          starting_credits: number
          starting_level: number
          starting_xp: number
          updated_at: string
          vendor_program_enabled: boolean
          vendor_terms_text: string | null
          vendor_terms_url: string | null
        }
        Insert: {
          credit_purchasing_enabled?: boolean
          current_event?: string | null
          default_map_id?: string | null
          email_verification_required?: boolean
          extra?: Json
          favicon_url?: string | null
          game_name?: string
          global_announcement?: string | null
          gravity?: number
          id?: number
          jump_strength?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          max_username_length?: number
          movement_speed?: number
          music_volume?: number
          pickup_address?: string | null
          quest_timezone?: string
          registration_enabled?: boolean
          shipping_gems_cost?: number
          sound_volume?: number
          starting_credits?: number
          starting_level?: number
          starting_xp?: number
          updated_at?: string
          vendor_program_enabled?: boolean
          vendor_terms_text?: string | null
          vendor_terms_url?: string | null
        }
        Update: {
          credit_purchasing_enabled?: boolean
          current_event?: string | null
          default_map_id?: string | null
          email_verification_required?: boolean
          extra?: Json
          favicon_url?: string | null
          game_name?: string
          global_announcement?: string | null
          gravity?: number
          id?: number
          jump_strength?: number
          logo_url?: string | null
          maintenance_mode?: boolean
          max_username_length?: number
          movement_speed?: number
          music_volume?: number
          pickup_address?: string | null
          quest_timezone?: string
          registration_enabled?: boolean
          shipping_gems_cost?: number
          sound_volume?: number
          starting_credits?: number
          starting_level?: number
          starting_xp?: number
          updated_at?: string
          vendor_program_enabled?: boolean
          vendor_terms_text?: string | null
          vendor_terms_url?: string | null
        }
        Relationships: []
      }
      internal_cron_tokens: {
        Row: {
          created_at: string
          name: string
          token: string
        }
        Insert: {
          created_at?: string
          name: string
          token?: string
        }
        Update: {
          created_at?: string
          name?: string
          token?: string
        }
        Relationships: []
      }
      levels: {
        Row: {
          cosmetic_reward: string | null
          credit_reward: number
          level: number
          title_reward: string | null
          unlocks: Json
          xp_required: number
        }
        Insert: {
          cosmetic_reward?: string | null
          credit_reward?: number
          level: number
          title_reward?: string | null
          unlocks?: Json
          xp_required: number
        }
        Update: {
          cosmetic_reward?: string | null
          credit_reward?: number
          level?: number
          title_reward?: string | null
          unlocks?: Json
          xp_required?: number
        }
        Relationships: [
          {
            foreignKeyName: "levels_cosmetic_reward_fkey"
            columns: ["cosmetic_reward"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "levels_title_reward_fkey"
            columns: ["title_reward"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rip_slots: {
        Row: {
          created_at: string
          credits_paid: number
          id: string
          order_id: string | null
          rip_id: string
          slot_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          credits_paid?: number
          id?: string
          order_id?: string | null
          rip_id: string
          slot_number: number
          user_id: string
        }
        Update: {
          created_at?: string
          credits_paid?: number
          id?: string
          order_id?: string | null
          rip_id?: string
          slot_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_rip_slots_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_rip_slots_rip_id_fkey"
            columns: ["rip_id"]
            isOneToOne: false
            referencedRelation: "live_rips"
            referencedColumns: ["id"]
          },
        ]
      }
      live_rips: {
        Row: {
          active: boolean
          closed_at: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          max_slots_per_user: number
          name: string
          price_credits: number
          product_id: string | null
          scheduled_at: string
          status: string
          store_id: string | null
          total_slots: number
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          active?: boolean
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          max_slots_per_user?: number
          name: string
          price_credits?: number
          product_id?: string | null
          scheduled_at?: string
          status?: string
          store_id?: string | null
          total_slots?: number
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          active?: boolean
          closed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          max_slots_per_user?: number
          name?: string
          price_credits?: number
          product_id?: string | null
          scheduled_at?: string
          status?: string
          store_id?: string | null
          total_slots?: number
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_rips_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_rips_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      map_objects: {
        Row: {
          collision: boolean
          created_at: string
          depth: number
          height: number
          id: string
          interactive: boolean
          layer: number
          locked: boolean
          map_version_id: string
          metadata: Json
          object_type: string
          reference_id: string | null
          rotation: number
          scale: number
          visible: boolean
          width: number
          x: number
          y: number
        }
        Insert: {
          collision?: boolean
          created_at?: string
          depth?: number
          height?: number
          id?: string
          interactive?: boolean
          layer?: number
          locked?: boolean
          map_version_id: string
          metadata?: Json
          object_type: string
          reference_id?: string | null
          rotation?: number
          scale?: number
          visible?: boolean
          width?: number
          x?: number
          y?: number
        }
        Update: {
          collision?: boolean
          created_at?: string
          depth?: number
          height?: number
          id?: string
          interactive?: boolean
          layer?: number
          locked?: boolean
          map_version_id?: string
          metadata?: Json
          object_type?: string
          reference_id?: string | null
          rotation?: number
          scale?: number
          visible?: boolean
          width?: number
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_objects_map_version_id_fkey"
            columns: ["map_version_id"]
            isOneToOne: false
            referencedRelation: "map_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      map_versions: {
        Row: {
          created_at: string
          created_by: string | null
          data: Json
          id: string
          map_id: string
          published_at: string | null
          status: string
          version_number: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          map_id: string
          published_at?: string | null
          status?: string
          version_number: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: Json
          id?: string
          map_id?: string
          published_at?: string | null
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "map_versions_map_id_fkey"
            columns: ["map_id"]
            isOneToOne: false
            referencedRelation: "maps"
            referencedColumns: ["id"]
          },
        ]
      }
      maps: {
        Row: {
          background_color: string | null
          background_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          dimension: string
          draft_version_id: string | null
          floor_color: string | null
          floor_texture_url: string | null
          floor_type: string
          height: number
          id: string
          is_active: boolean
          is_archived: boolean
          is_public_room: boolean
          music_url: string | null
          name: string
          parallax_config: Json
          published_version_id: string | null
          slug: string
          updated_at: string
          viewport_height: number
          viewport_width: number
          width: number
        }
        Insert: {
          background_color?: string | null
          background_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dimension?: string
          draft_version_id?: string | null
          floor_color?: string | null
          floor_texture_url?: string | null
          floor_type?: string
          height?: number
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_public_room?: boolean
          music_url?: string | null
          name: string
          parallax_config?: Json
          published_version_id?: string | null
          slug: string
          updated_at?: string
          viewport_height?: number
          viewport_width?: number
          width?: number
        }
        Update: {
          background_color?: string | null
          background_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          dimension?: string
          draft_version_id?: string | null
          floor_color?: string | null
          floor_texture_url?: string | null
          floor_type?: string
          height?: number
          id?: string
          is_active?: boolean
          is_archived?: boolean
          is_public_room?: boolean
          music_url?: string | null
          name?: string
          parallax_config?: Json
          published_version_id?: string | null
          slug?: string
          updated_at?: string
          viewport_height?: number
          viewport_width?: number
          width?: number
        }
        Relationships: []
      }
      mystery_boxes: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          guaranteed_value: number | null
          id: string
          image_url: string | null
          name: string
          price_credits: number
          rewards: Json
          stock: number | null
          store_id: string | null
          unlimited_stock: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          guaranteed_value?: number | null
          id?: string
          image_url?: string | null
          name: string
          price_credits?: number
          rewards?: Json
          stock?: number | null
          store_id?: string | null
          unlimited_stock?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          guaranteed_value?: number | null
          id?: string
          image_url?: string | null
          name?: string
          price_credits?: number
          rewards?: Json
          stock?: number | null
          store_id?: string | null
          unlimited_stock?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mystery_boxes_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      npc_appearances: {
        Row: {
          active: boolean
          created_at: string
          height: number
          id: string
          name: string
          sprite_jump_url: string | null
          sprite_left_url: string | null
          sprite_right_url: string | null
          sprite_url: string | null
          thumbnail_url: string | null
          width: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          height?: number
          id?: string
          name: string
          sprite_jump_url?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          sprite_url?: string | null
          thumbnail_url?: string | null
          width?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          height?: number
          id?: string
          name?: string
          sprite_jump_url?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          sprite_url?: string | null
          thumbnail_url?: string | null
          width?: number
        }
        Relationships: []
      }
      npc_messages: {
        Row: {
          auto_speech: boolean
          created_at: string
          enabled: boolean
          end_date: string | null
          id: string
          interaction_only: boolean
          message: string
          min_level: number | null
          npc_id: string
          start_date: string | null
          weight: number
        }
        Insert: {
          auto_speech?: boolean
          created_at?: string
          enabled?: boolean
          end_date?: string | null
          id?: string
          interaction_only?: boolean
          message: string
          min_level?: number | null
          npc_id: string
          start_date?: string | null
          weight?: number
        }
        Update: {
          auto_speech?: boolean
          created_at?: string
          enabled?: boolean
          end_date?: string | null
          id?: string
          interaction_only?: boolean
          message?: string
          min_level?: number | null
          npc_id?: string
          start_date?: string | null
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "npc_messages_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
        ]
      }
      npcs: {
        Row: {
          action_config: Json
          action_type: string
          active: boolean
          appearance_id: string | null
          behavior: string
          created_at: string
          height: number | null
          id: string
          idle_duration_ms: number
          interaction_enabled: boolean
          movement_speed: number
          name: string
          random_speech_enabled: boolean
          slug: string
          speech_interval_max_ms: number
          speech_interval_min_ms: number
          sprite_jump_url: string | null
          sprite_left_url: string | null
          sprite_right_url: string | null
          sprite_url: string | null
          thumbnail_url: string | null
          walk_range: number
          width: number | null
        }
        Insert: {
          action_config?: Json
          action_type?: string
          active?: boolean
          appearance_id?: string | null
          behavior?: string
          created_at?: string
          height?: number | null
          id?: string
          idle_duration_ms?: number
          interaction_enabled?: boolean
          movement_speed?: number
          name: string
          random_speech_enabled?: boolean
          slug: string
          speech_interval_max_ms?: number
          speech_interval_min_ms?: number
          sprite_jump_url?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          sprite_url?: string | null
          thumbnail_url?: string | null
          walk_range?: number
          width?: number | null
        }
        Update: {
          action_config?: Json
          action_type?: string
          active?: boolean
          appearance_id?: string | null
          behavior?: string
          created_at?: string
          height?: number | null
          id?: string
          idle_duration_ms?: number
          interaction_enabled?: boolean
          movement_speed?: number
          name?: string
          random_speech_enabled?: boolean
          slug?: string
          speech_interval_max_ms?: number
          speech_interval_min_ms?: number
          sprite_jump_url?: string | null
          sprite_left_url?: string | null
          sprite_right_url?: string | null
          sprite_url?: string | null
          thumbnail_url?: string | null
          walk_range?: number
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "npcs_appearance_id_fkey"
            columns: ["appearance_id"]
            isOneToOne: false
            referencedRelation: "npc_appearances"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cash_amount: number | null
          cosmetic_id: string | null
          created_at: string
          credit_package_id: string | null
          credits_charged: number
          currency: string | null
          delivered_at: string | null
          delivery_address: string | null
          fulfillment_status: string
          id: string
          order_number: number
          order_type: string
          payment_provider: string | null
          payment_reference: string | null
          payment_status: string | null
          payment_token: string | null
          product_id: string | null
          quantity: number
          shipment_number: number | null
          shipping_gems_paid: number
          shipping_info: Json | null
          shipping_method: string | null
          status: string
          store_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cash_amount?: number | null
          cosmetic_id?: string | null
          created_at?: string
          credit_package_id?: string | null
          credits_charged?: number
          currency?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          fulfillment_status?: string
          id?: string
          order_number?: number
          order_type: string
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_token?: string | null
          product_id?: string | null
          quantity?: number
          shipment_number?: number | null
          shipping_gems_paid?: number
          shipping_info?: Json | null
          shipping_method?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cash_amount?: number | null
          cosmetic_id?: string | null
          created_at?: string
          credit_package_id?: string | null
          credits_charged?: number
          currency?: string | null
          delivered_at?: string | null
          delivery_address?: string | null
          fulfillment_status?: string
          id?: string
          order_number?: number
          order_type?: string
          payment_provider?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          payment_token?: string | null
          product_id?: string | null
          quantity?: number
          shipment_number?: number | null
          shipping_gems_paid?: number
          shipping_info?: Json | null
          shipping_method?: string | null
          status?: string
          store_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_credit_package_id_fkey"
            columns: ["credit_package_id"]
            isOneToOne: false
            referencedRelation: "credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      player_clues: {
        Row: {
          clue_id: string
          created_at: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          clue_id: string
          created_at?: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          clue_id?: string
          created_at?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_clues_clue_id_fkey"
            columns: ["clue_id"]
            isOneToOne: false
            referencedRelation: "clues"
            referencedColumns: ["id"]
          },
        ]
      }
      player_cosmetics: {
        Row: {
          acquired_at: string
          cosmetic_id: string
          id: string
          source: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          cosmetic_id: string
          id?: string
          source?: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          cosmetic_id?: string
          id?: string
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_cosmetics_cosmetic_id_fkey"
            columns: ["cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          image_url: string | null
          kind: string
          link: string | null
          metadata: Json
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          link?: string | null
          metadata?: Json
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          kind?: string
          link?: string | null
          metadata?: Json
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      player_quests: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          id: string
          period_key: string | null
          progress: number
          quest_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          id?: string
          period_key?: string | null
          progress?: number
          quest_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          id?: string
          period_key?: string | null
          progress?: number
          quest_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_quests_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
        ]
      }
      player_titles: {
        Row: {
          acquired_at: string
          id: string
          title_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string
          id?: string
          title_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string
          id?: string
          title_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_titles_title_id_fkey"
            columns: ["title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      player_treasures: {
        Row: {
          box_id: string
          created_at: string
          id: string
          reward: Json
          user_id: string
        }
        Insert: {
          box_id: string
          created_at?: string
          id?: string
          reward?: Json
          user_id: string
        }
        Update: {
          box_id?: string
          created_at?: string
          id?: string
          reward?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_treasures_box_id_fkey"
            columns: ["box_id"]
            isOneToOne: false
            referencedRelation: "treasure_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          id: string
          name: string
          parent_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name: string
          parent_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string | null
          cash_price: number | null
          category: string | null
          created_at: string
          credit_price: number
          description: string | null
          end_date: string | null
          external_url: string | null
          gallery: Json
          id: string
          image_url: string | null
          limited_edition: boolean
          linked_cosmetic_id: string | null
          linked_title_id: string | null
          name: string
          product_type: string
          purchase_limit: number | null
          quest_requirement: string | null
          regular_price: number | null
          required_level: number
          sale_credit_price: number | null
          sale_price: number | null
          set_name: string | null
          sku: string | null
          start_date: string | null
          stock: number | null
          store_id: string | null
          store_ids: string[] | null
          subcategory: string | null
          tags: string[]
          unlimited_stock: boolean
          vendor_id: string | null
          vendor_status: string
          woo_product_id: number | null
          woo_synced_at: string | null
        }
        Insert: {
          active?: boolean
          brand?: string | null
          cash_price?: number | null
          category?: string | null
          created_at?: string
          credit_price?: number
          description?: string | null
          end_date?: string | null
          external_url?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          limited_edition?: boolean
          linked_cosmetic_id?: string | null
          linked_title_id?: string | null
          name: string
          product_type?: string
          purchase_limit?: number | null
          quest_requirement?: string | null
          regular_price?: number | null
          required_level?: number
          sale_credit_price?: number | null
          sale_price?: number | null
          set_name?: string | null
          sku?: string | null
          start_date?: string | null
          stock?: number | null
          store_id?: string | null
          store_ids?: string[] | null
          subcategory?: string | null
          tags?: string[]
          unlimited_stock?: boolean
          vendor_id?: string | null
          vendor_status?: string
          woo_product_id?: number | null
          woo_synced_at?: string | null
        }
        Update: {
          active?: boolean
          brand?: string | null
          cash_price?: number | null
          category?: string | null
          created_at?: string
          credit_price?: number
          description?: string | null
          end_date?: string | null
          external_url?: string | null
          gallery?: Json
          id?: string
          image_url?: string | null
          limited_edition?: boolean
          linked_cosmetic_id?: string | null
          linked_title_id?: string | null
          name?: string
          product_type?: string
          purchase_limit?: number | null
          quest_requirement?: string | null
          regular_price?: number | null
          required_level?: number
          sale_credit_price?: number | null
          sale_price?: number | null
          set_name?: string | null
          sku?: string | null
          start_date?: string | null
          stock?: number | null
          store_id?: string | null
          store_ids?: string[] | null
          subcategory?: string | null
          tags?: string[]
          unlimited_stock?: boolean
          vendor_id?: string | null
          vendor_status?: string
          woo_product_id?: number | null
          woo_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_linked_cosmetic_id_fkey"
            columns: ["linked_cosmetic_id"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_linked_title_id_fkey"
            columns: ["linked_title_id"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active_title_id: string | null
          admin_notes: string | null
          avatar_config: Json
          character_id: string | null
          created_at: string
          credits: number
          current_map_id: string | null
          display_name: string | null
          email_verified: boolean
          id: string
          is_muted: boolean
          is_suspended: boolean
          last_x: number
          last_y: number
          level: number
          role_id: string | null
          settings: Json
          updated_at: string
          username: string
          xp: number
        }
        Insert: {
          active_title_id?: string | null
          admin_notes?: string | null
          avatar_config?: Json
          character_id?: string | null
          created_at?: string
          credits?: number
          current_map_id?: string | null
          display_name?: string | null
          email_verified?: boolean
          id: string
          is_muted?: boolean
          is_suspended?: boolean
          last_x?: number
          last_y?: number
          level?: number
          role_id?: string | null
          settings?: Json
          updated_at?: string
          username: string
          xp?: number
        }
        Update: {
          active_title_id?: string | null
          admin_notes?: string | null
          avatar_config?: Json
          character_id?: string | null
          created_at?: string
          credits?: number
          current_map_id?: string | null
          display_name?: string | null
          email_verified?: boolean
          id?: string
          is_muted?: boolean
          is_suspended?: boolean
          last_x?: number
          last_y?: number
          level?: number
          role_id?: string | null
          settings?: Json
          updated_at?: string
          username?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_character_id_fkey"
            columns: ["character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "character_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      prohibited_words: {
        Row: {
          created_at: string
          id: string
          word: string
        }
        Insert: {
          created_at?: string
          id?: string
          word: string
        }
        Update: {
          created_at?: string
          id?: string
          word?: string
        }
        Relationships: []
      }
      quests: {
        Row: {
          action_type: string
          active: boolean
          auto_claim: boolean
          cosmetic_reward: string | null
          created_at: string
          credit_reward: number
          description: string | null
          end_date: string | null
          icon_url: string | null
          id: string
          metadata: Json
          name: string
          prerequisite_quest: string | null
          quest_type: string
          required_level: number
          slug: string
          sort_order: number
          start_date: string | null
          target_amount: number
          title_reward: string | null
          xp_reward: number
        }
        Insert: {
          action_type: string
          active?: boolean
          auto_claim?: boolean
          cosmetic_reward?: string | null
          created_at?: string
          credit_reward?: number
          description?: string | null
          end_date?: string | null
          icon_url?: string | null
          id?: string
          metadata?: Json
          name: string
          prerequisite_quest?: string | null
          quest_type?: string
          required_level?: number
          slug: string
          sort_order?: number
          start_date?: string | null
          target_amount?: number
          title_reward?: string | null
          xp_reward?: number
        }
        Update: {
          action_type?: string
          active?: boolean
          auto_claim?: boolean
          cosmetic_reward?: string | null
          created_at?: string
          credit_reward?: number
          description?: string | null
          end_date?: string | null
          icon_url?: string | null
          id?: string
          metadata?: Json
          name?: string
          prerequisite_quest?: string | null
          quest_type?: string
          required_level?: number
          slug?: string
          sort_order?: number
          start_date?: string | null
          target_amount?: number
          title_reward?: string | null
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "quests_cosmetic_reward_fkey"
            columns: ["cosmetic_reward"]
            isOneToOne: false
            referencedRelation: "cosmetics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quests_prerequisite_quest_fkey"
            columns: ["prerequisite_quest"]
            isOneToOne: false
            referencedRelation: "quests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quests_title_reward_fkey"
            columns: ["title_reward"]
            isOneToOne: false
            referencedRelation: "titles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          npc_id: string | null
          status: string
          store_id: string | null
          subject: string | null
          unread_owner: number
          unread_user: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          npc_id?: string | null
          status?: string
          store_id?: string | null
          subject?: string | null
          unread_owner?: number
          unread_user?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          npc_id?: string | null
          status?: string
          store_id?: string | null
          subject?: string | null
          unread_owner?: number
          unread_user?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_conversations_npc_id_fkey"
            columns: ["npc_id"]
            isOneToOne: false
            referencedRelation: "npcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_conversations_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_visual_templates: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          height: number
          id: string
          metadata: Json
          name: string
          sprite_url: string | null
          thumbnail_url: string | null
          width: number
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          height?: number
          id?: string
          metadata?: Json
          name: string
          sprite_url?: string | null
          thumbnail_url?: string | null
          width?: number
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          height?: number
          id?: string
          metadata?: Json
          name?: string
          sprite_url?: string | null
          thumbnail_url?: string | null
          width?: number
        }
        Relationships: []
      }
      stores: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          interaction_type: string
          is_open: boolean
          metadata: Json
          music_url: string | null
          name: string
          slug: string
          store_type: string
          visual_template_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          interaction_type?: string
          is_open?: boolean
          metadata?: Json
          music_url?: string | null
          name: string
          slug: string
          store_type?: string
          visual_template_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          interaction_type?: string
          is_open?: boolean
          metadata?: Json
          music_url?: string | null
          name?: string
          slug?: string
          store_type?: string
          visual_template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_visual_template_id_fkey"
            columns: ["visual_template_id"]
            isOneToOne: false
            referencedRelation: "store_visual_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      titles: {
        Row: {
          active: boolean
          created_at: string
          credit_price: number | null
          description: string | null
          icon_url: string | null
          id: string
          level_requirement: number | null
          name: string
          quest_requirement: string | null
          slug: string
          unlock_rule: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          credit_price?: number | null
          description?: string | null
          icon_url?: string | null
          id?: string
          level_requirement?: number | null
          name: string
          quest_requirement?: string | null
          slug: string
          unlock_rule?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          credit_price?: number | null
          description?: string | null
          icon_url?: string | null
          id?: string
          level_requirement?: number | null
          name?: string
          quest_requirement?: string | null
          slug?: string
          unlock_rule?: string
        }
        Relationships: []
      }
      treasure_boxes: {
        Row: {
          active: boolean
          box_type: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          one_per_player: boolean
          require_all_clues: boolean
          require_mode: string
          required_character_id: string | null
          required_level: number | null
          required_role_id: string | null
          reward: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          box_type?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          one_per_player?: boolean
          require_all_clues?: boolean
          require_mode?: string
          required_character_id?: string | null
          required_level?: number | null
          required_role_id?: string | null
          reward?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          box_type?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          one_per_player?: boolean
          require_all_clues?: boolean
          require_mode?: string
          required_character_id?: string | null
          required_level?: number | null
          required_role_id?: string | null
          reward?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "treasure_boxes_required_character_id_fkey"
            columns: ["required_character_id"]
            isOneToOne: false
            referencedRelation: "characters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "treasure_boxes_required_role_id_fkey"
            columns: ["required_role_id"]
            isOneToOne: false
            referencedRelation: "character_roles"
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
      vendors: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          shop_name: string | null
          status: string
          terms_accepted_at: string
          terms_version: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          shop_name?: string | null
          status?: string
          terms_accepted_at?: string
          terms_version?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          shop_name?: string | null
          status?: string
          terms_accepted_at?: string
          terms_version?: string
          user_id?: string
        }
        Relationships: []
      }
      wheel_configs: {
        Row: {
          active: boolean
          created_at: string
          daily_free_spins: number
          daily_spin_limit: number
          description: string | null
          end_date: string | null
          id: string
          image_url: string | null
          name: string
          rewards: Json
          spin_cost_credits: number
          start_date: string | null
          store_id: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_free_spins?: number
          daily_spin_limit?: number
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          name: string
          rewards?: Json
          spin_cost_credits?: number
          start_date?: string | null
          store_id?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_free_spins?: number
          daily_spin_limit?: number
          description?: string | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          name?: string
          rewards?: Json
          spin_cost_credits?: number
          start_date?: string | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wheel_configs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      wheel_spins: {
        Row: {
          created_at: string
          id: string
          reward: Json
          spin_date: string
          user_id: string
          wheel_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reward: Json
          spin_date?: string
          user_id: string
          wheel_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reward?: Json
          spin_date?: string
          user_id?: string
          wheel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wheel_spins_wheel_id_fkey"
            columns: ["wheel_id"]
            isOneToOne: false
            referencedRelation: "wheel_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buy_and_equip_cosmetic: { Args: { _cosmetic_id: string }; Returns: Json }
      cancel_auction: { Args: { _auction_id: string }; Returns: Json }
      claim_quest_reward: {
        Args: { _period_key: string; _quest_id: string }
        Returns: Json
      }
      close_live_rip: { Args: { _rip_id: string }; Returns: Json }
      credit_gem_pack: {
        Args: { _order_id: string; _reference: string }
        Returns: Json
      }
      get_auction_bid_feed: {
        Args: { _auction_id: string; _limit?: number }
        Returns: {
          amount: number
          bidder_name: string
          created_at: string
          id: string
          is_me: boolean
        }[]
      }
      get_my_clue_progress: {
        Args: never
        Returns: {
          box_id: string
          box_image: string
          box_name: string
          box_type: string
          clues_owned: number
          clues_total: number
          opened: boolean
          owned_clues: Json
        }[]
      }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          active_title_id: string
          avatar_config: Json
          character_id: string
          created_at: string
          current_map_id: string
          display_name: string
          id: string
          last_x: number
          last_y: number
          level: number
          username: string
          xp: number
        }[]
      }
      get_store_clues: {
        Args: { _store_id: string }
        Returns: {
          box_name: string
          id: string
          image_url: string
          name: string
          owned: boolean
          price_credits: number
        }[]
      }
      get_treasure_box_state: { Args: { _box_id: string }; Returns: Json }
      grant_clue: {
        Args: { _clue_id: string; _source?: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_owner: { Args: never; Returns: boolean }
      issue_email_verification_code: { Args: never; Returns: string }
      join_live_rip: {
        Args: { _count?: number; _rip_id: string }
        Returns: Json
      }
      mark_order_delivered: { Args: { _order_id: string }; Returns: Json }
      notify_player: {
        Args: {
          _body?: string
          _image_url?: string
          _kind: string
          _link?: string
          _metadata?: Json
          _title: string
          _user_id: string
        }
        Returns: string
      }
      open_mystery_box: { Args: { _box_id: string }; Returns: Json }
      open_treasure_box: { Args: { _box_id: string }; Returns: Json }
      place_auction_bid: { Args: { _auction_id: string }; Returns: Json }
      progress_quest: {
        Args: { _action_type: string; _amount?: number }
        Returns: undefined
      }
      purchase_cosmetic: { Args: { _cosmetic_id: string }; Returns: Json }
      purchase_product: { Args: { _product_id: string }; Returns: Json }
      remove_product_from_wheels: {
        Args: { _product_id: string }
        Returns: undefined
      }
      request_bulk_delivery: {
        Args: { _address: string; _method: string; _order_ids: string[] }
        Returns: Json
      }
      request_delivery: {
        Args: { _address: string; _method: string; _order_id: string }
        Returns: Json
      }
      search_public_profiles: {
        Args: { _limit?: number; _prefix: string }
        Returns: {
          display_name: string
          id: string
          level: number
          username: string
        }[]
      }
      set_main_map: { Args: { _map_id: string }; Returns: Json }
      settle_auction: { Args: { _auction_id: string }; Returns: Json }
      spin_wheel: { Args: { _wheel_id: string }; Returns: Json }
      verify_email_code: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "player" | "owner"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["player", "owner"],
    },
  },
} as const

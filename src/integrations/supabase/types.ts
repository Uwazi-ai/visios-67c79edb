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
      agent_requests: {
        Row: {
          agent_name: string
          content: Json
          created_at: string | null
          executed_at: string | null
          id: string
          priority: string | null
          request_type: string
          result: Json | null
          reviewed_at: string | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          agent_name: string
          content: Json
          created_at?: string | null
          executed_at?: string | null
          id?: string
          priority?: string | null
          request_type: string
          result?: Json | null
          reviewed_at?: string | null
          status?: string | null
          tenant_id?: string
          title: string
        }
        Update: {
          agent_name?: string
          content?: Json
          created_at?: string | null
          executed_at?: string | null
          id?: string
          priority?: string | null
          request_type?: string
          result?: Json | null
          reviewed_at?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          created_at: string
          gmail_auto_approve_known_domains: boolean
          gmail_contact_sync_enabled: boolean
          gmail_last_synced_at: string | null
          gmail_min_email_count: number
          gmail_sync_frequency_hours: number
          gmail_sync_lookback_days: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gmail_auto_approve_known_domains?: boolean
          gmail_contact_sync_enabled?: boolean
          gmail_last_synced_at?: string | null
          gmail_min_email_count?: number
          gmail_sync_frequency_hours?: number
          gmail_sync_lookback_days?: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gmail_auto_approve_known_domains?: boolean
          gmail_contact_sync_enabled?: boolean
          gmail_last_synced_at?: string | null
          gmail_min_email_count?: number
          gmail_sync_frequency_hours?: number
          gmail_sync_lookback_days?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          created_at: string
          id: string
          org_id: string | null
          persona: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id?: string | null
          persona?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string | null
          persona?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_messages: {
        Row: {
          citations: Json
          content: string
          conversation_id: string
          created_at: string
          id: string
          persona: string | null
          role: string
          user_id: string
        }
        Insert: {
          citations?: Json
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          persona?: string | null
          role: string
          user_id: string
        }
        Update: {
          citations?: Json
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          persona?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_training: {
        Row: {
          canned_responses: Json
          created_at: string
          id: string
          never_say: string | null
          org_context: Json
          response_length: string
          sample_emails: Json
          signature_style: string
          updated_at: string
          user_id: string
          workflow_notes: Json
          writing_style: string
        }
        Insert: {
          canned_responses?: Json
          created_at?: string
          id?: string
          never_say?: string | null
          org_context?: Json
          response_length?: string
          sample_emails?: Json
          signature_style?: string
          updated_at?: string
          user_id: string
          workflow_notes?: Json
          writing_style?: string
        }
        Update: {
          canned_responses?: Json
          created_at?: string
          id?: string
          never_say?: string | null
          org_context?: Json
          response_length?: string
          sample_emails?: Json
          signature_style?: string
          updated_at?: string
          user_id?: string
          workflow_notes?: Json
          writing_style?: string
        }
        Relationships: []
      }
      app_versions: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          released_at: string
          released_by: string | null
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          released_at?: string
          released_by?: string | null
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          released_at?: string
          released_by?: string | null
          version?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          reason: string | null
          target: string | null
          tenant_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target?: string | null
          tenant_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target?: string | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          created_at: string
          end_at: string
          event_type_id: string | null
          google_event_id: string | null
          id: string
          intake_data: Json
          invitee_email: string
          invitee_name: string
          org_id: string | null
          prep_brief: string | null
          start_at: string
          status: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          end_at: string
          event_type_id?: string | null
          google_event_id?: string | null
          id?: string
          intake_data?: Json
          invitee_email: string
          invitee_name: string
          org_id?: string | null
          prep_brief?: string | null
          start_at: string
          status?: string | null
          tenant_id?: string
        }
        Update: {
          created_at?: string
          end_at?: string
          event_type_id?: string | null
          google_event_id?: string | null
          id?: string
          intake_data?: Json
          invitee_email?: string
          invitee_name?: string
          org_id?: string | null
          prep_brief?: string | null
          start_at?: string
          status?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_preferences: {
        Row: {
          id: string
          updated_at: string
          user_id: string
          visible_member_ids: string[]
        }
        Insert: {
          id?: string
          updated_at?: string
          user_id: string
          visible_member_ids?: string[]
        }
        Update: {
          id?: string
          updated_at?: string
          user_id?: string
          visible_member_ids?: string[]
        }
        Relationships: []
      }
      channels: {
        Row: {
          created_at: string
          dm_participants: string[]
          id: string
          is_dm: boolean
          is_system: boolean
          name: string | null
          org_id: string | null
          participants: Json
          type: string | null
        }
        Insert: {
          created_at?: string
          dm_participants?: string[]
          id?: string
          is_dm?: boolean
          is_system?: boolean
          name?: string | null
          org_id?: string | null
          participants?: Json
          type?: string | null
        }
        Update: {
          created_at?: string
          dm_participants?: string[]
          id?: string
          is_dm?: boolean
          is_system?: boolean
          name?: string | null
          org_id?: string | null
          participants?: Json
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_booking_link_slots: {
        Row: {
          created_at: string
          end_at: string
          id: string
          link_id: string
          start_at: string
        }
        Insert: {
          created_at?: string
          end_at: string
          id?: string
          link_id: string
          start_at: string
        }
        Update: {
          created_at?: string
          end_at?: string
          id?: string
          link_id?: string
          start_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_booking_link_slots_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "contact_booking_links"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_booking_links: {
        Row: {
          booked_at: string | null
          booked_slot_id: string | null
          contact_id: string | null
          created_at: string
          description: string | null
          duration_mins: number
          expires_at: string | null
          google_event_id: string | null
          host_user_id: string
          id: string
          invitee_email: string | null
          invitee_name: string | null
          location: string | null
          meet_link: string | null
          org_id: string | null
          status: string
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          booked_at?: string | null
          booked_slot_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          duration_mins?: number
          expires_at?: string | null
          google_event_id?: string | null
          host_user_id: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string | null
          location?: string | null
          meet_link?: string | null
          org_id?: string | null
          status?: string
          title?: string
          token?: string
          updated_at?: string
        }
        Update: {
          booked_at?: string | null
          booked_slot_id?: string | null
          contact_id?: string | null
          created_at?: string
          description?: string | null
          duration_mins?: number
          expires_at?: string | null
          google_event_id?: string | null
          host_user_id?: string
          id?: string
          invitee_email?: string | null
          invitee_name?: string | null
          location?: string | null
          meet_link?: string | null
          org_id?: string | null
          status?: string
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_booking_links_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_booking_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_booking_links_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_interactions: {
        Row: {
          contact_id: string
          created_at: string
          external_id: string | null
          id: string
          occurred_at: string
          org_id: string | null
          source: string
          summary: string | null
          title: string | null
          type: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          external_id?: string | null
          id?: string
          occurred_at?: string
          org_id?: string | null
          source?: string
          summary?: string | null
          title?: string | null
          type: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          external_id?: string | null
          id?: string
          occurred_at?: string
          org_id?: string | null
          source?: string
          summary?: string | null
          title?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_review_queue: {
        Row: {
          company: string | null
          confidence: string
          created_at: string
          email: string
          email_count: number
          id: string
          last_email_date: string | null
          linkedin_url: string | null
          name: string | null
          phone: string | null
          raw_signature: string | null
          sample_subject: string | null
          source: string
          status: string
          suggested_org_id: string | null
          thread_refs: Json
          title: string | null
          user_id: string
        }
        Insert: {
          company?: string | null
          confidence?: string
          created_at?: string
          email: string
          email_count?: number
          id?: string
          last_email_date?: string | null
          linkedin_url?: string | null
          name?: string | null
          phone?: string | null
          raw_signature?: string | null
          sample_subject?: string | null
          source?: string
          status?: string
          suggested_org_id?: string | null
          thread_refs?: Json
          title?: string | null
          user_id: string
        }
        Update: {
          company?: string | null
          confidence?: string
          created_at?: string
          email?: string
          email_count?: number
          id?: string
          last_email_date?: string | null
          linkedin_url?: string | null
          name?: string | null
          phone?: string | null
          raw_signature?: string | null
          sample_subject?: string | null
          source?: string
          status?: string
          suggested_org_id?: string | null
          thread_refs?: Json
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_review_queue_suggested_org_id_fkey"
            columns: ["suggested_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_review_queue_suggested_org_id_fkey"
            columns: ["suggested_org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string | null
          engagement_stage: string
          id: string
          last_touched_at: string | null
          linkedin_url: string | null
          metadata: Json
          name: string
          notes: string | null
          org_id: string | null
          phone: string | null
          role: string | null
          tenant_id: string
          visibility: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          engagement_stage?: string
          id?: string
          last_touched_at?: string | null
          linkedin_url?: string | null
          metadata?: Json
          name: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          role?: string | null
          tenant_id?: string
          visibility?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          engagement_stage?: string
          id?: string
          last_touched_at?: string | null
          linkedin_url?: string | null
          metadata?: Json
          name?: string
          notes?: string | null
          org_id?: string | null
          phone?: string | null
          role?: string | null
          tenant_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefs: {
        Row: {
          brief_date: string
          id: string
          triggered_at: string
          user_id: string
        }
        Insert: {
          brief_date?: string
          id?: string
          triggered_at?: string
          user_id: string
        }
        Update: {
          brief_date?: string
          id?: string
          triggered_at?: string
          user_id?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          contact_id: string | null
          created_at: string
          id: string
          notes: string | null
          org_id: string | null
          stage: string
          title: string
          value: number | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          stage: string
          title: string
          value?: number | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          org_id?: string | null
          stage?: string
          title?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      event_attendees: {
        Row: {
          added_at: string
          added_by: string | null
          event_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          event_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          event_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          active: boolean | null
          buffer_after: number | null
          buffer_before: number | null
          created_at: string
          description: string | null
          duration_mins: number | null
          id: string
          intake_fields: Json
          name: string
          org_id: string | null
          slug: string
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          buffer_after?: number | null
          buffer_before?: number | null
          created_at?: string
          description?: string | null
          duration_mins?: number | null
          id?: string
          intake_fields?: Json
          name: string
          org_id?: string | null
          slug: string
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          buffer_after?: number | null
          buffer_before?: number | null
          created_at?: string
          description?: string | null
          duration_mins?: number | null
          id?: string
          intake_fields?: Json
          name?: string
          org_id?: string | null
          slug?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attendees: Json
          color: string | null
          created_at: string
          created_by: string | null
          end_at: string | null
          google_event_id: string | null
          id: string
          meet_link: string | null
          org_id: string | null
          prep_notes: string | null
          start_at: string | null
          summary: string | null
          title: string
          user_id: string | null
          visibility: string
        }
        Insert: {
          attendees?: Json
          color?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          org_id?: string | null
          prep_notes?: string | null
          start_at?: string | null
          summary?: string | null
          title: string
          user_id?: string | null
          visibility?: string
        }
        Update: {
          attendees?: Json
          color?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          google_event_id?: string | null
          id?: string
          meet_link?: string | null
          org_id?: string | null
          prep_notes?: string | null
          start_at?: string | null
          summary?: string | null
          title?: string
          user_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fundraising_opportunities: {
        Row: {
          assigned_to: string | null
          committed_amount: number
          created_at: string
          created_by: string | null
          deadline: string | null
          entity: string
          id: string
          name: string
          next_action: string | null
          notes: string | null
          order_num: number
          organization: string
          phase: number
          status: string
          target_amount: string | null
          tenant_id: string
          type: string
          updated_at: string
          urgency: string
        }
        Insert: {
          assigned_to?: string | null
          committed_amount?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          entity?: string
          id?: string
          name: string
          next_action?: string | null
          notes?: string | null
          order_num: number
          organization: string
          phase?: number
          status?: string
          target_amount?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          assigned_to?: string | null
          committed_amount?: number
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          entity?: string
          id?: string
          name?: string
          next_action?: string | null
          notes?: string | null
          order_num?: number
          organization?: string
          phase?: number
          status?: string
          target_amount?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "fundraising_opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      fundraising_tasks: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          due_at: string | null
          id: string
          opportunity_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          opportunity_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          due_at?: string | null
          id?: string
          opportunity_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fundraising_tasks_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "fundraising_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_opportunities: {
        Row: {
          alignment: string | null
          amount_max: number | null
          amount_min: number | null
          created_at: string | null
          deadline: string | null
          description: string | null
          focus_area: string | null
          funder: string
          funder_type: string | null
          id: string
          name: string
          notes: string | null
          status: string | null
          tags: string[] | null
          tenant_id: string
          updated_at: string | null
          url: string | null
        }
        Insert: {
          alignment?: string | null
          amount_max?: number | null
          amount_min?: number | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          focus_area?: string | null
          funder: string
          funder_type?: string | null
          id?: string
          name: string
          notes?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          alignment?: string | null
          amount_max?: number | null
          amount_min?: number | null
          created_at?: string | null
          deadline?: string | null
          description?: string | null
          focus_area?: string | null
          funder?: string
          funder_type?: string | null
          id?: string
          name?: string
          notes?: string | null
          status?: string | null
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_opportunities_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      grant_proposals: {
        Row: {
          amount_requested: string | null
          created_at: string | null
          deadline: string | null
          full_text: string
          funder: string
          grant_name: string
          id: string
          opportunity_id: string | null
          project_focus: string | null
          sections_generated: string[] | null
          status: string | null
          tone: string | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          amount_requested?: string | null
          created_at?: string | null
          deadline?: string | null
          full_text: string
          funder: string
          grant_name: string
          id?: string
          opportunity_id?: string | null
          project_focus?: string | null
          sections_generated?: string[] | null
          status?: string | null
          tone?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          amount_requested?: string | null
          created_at?: string | null
          deadline?: string | null
          full_text?: string
          funder?: string
          grant_name?: string
          id?: string
          opportunity_id?: string | null
          project_focus?: string | null
          sections_generated?: string[] | null
          status?: string | null
          tone?: string | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "grant_proposals_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "grant_opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      growth_agent_logs: {
        Row: {
          created_at: string | null
          error_text: string | null
          event_type: string
          id: string
          message_sent: string | null
          phone_number: string | null
          status: string | null
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string | null
          error_text?: string | null
          event_type: string
          id?: string
          message_sent?: string | null
          phone_number?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string | null
          error_text?: string | null
          event_type?: string
          id?: string
          message_sent?: string | null
          phone_number?: string | null
          status?: string | null
          twilio_sid?: string | null
        }
        Relationships: []
      }
      integrations: {
        Row: {
          created_at: string
          id: string
          kb_doc_count: number
          last_kb_sync_at: string | null
          last_synced_at: string | null
          metadata: Json
          org_id: string | null
          provider: string
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
          vision_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kb_doc_count?: number
          last_kb_sync_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          org_id?: string | null
          provider: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id: string
          vision_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kb_doc_count?: number
          last_kb_sync_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          org_id?: string | null
          provider?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
          vision_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          body: string | null
          created_at: string
          due_at: string | null
          id: string
          metadata: Json
          org_id: string | null
          priority: string | null
          source: string | null
          status: string | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          due_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          priority?: string | null
          source?: string | null
          status?: string | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          id: string
          org_id: string | null
          tenant_id: string
          tsv: unknown
          user_id: string
        }
        Insert: {
          chunk_index?: number
          content: string
          created_at?: string
          document_id: string
          id?: string
          org_id?: string | null
          tenant_id?: string
          tsv?: unknown
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          org_id?: string | null
          tenant_id?: string
          tsv?: unknown
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kb_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "kb_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kb_chunks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      kb_documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          error_message: string | null
          external_id: string | null
          file_path: string | null
          file_type: string | null
          full_text: string | null
          id: string
          org_id: string | null
          source_integration: string | null
          source_type: string
          source_url: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
          user_id: string
          word_count: number | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_id?: string | null
          file_path?: string | null
          file_type?: string | null
          full_text?: string | null
          id?: string
          org_id?: string | null
          source_integration?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          tenant_id?: string
          title: string
          updated_at?: string
          user_id: string
          word_count?: number | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          error_message?: string | null
          external_id?: string | null
          file_path?: string | null
          file_type?: string | null
          full_text?: string | null
          id?: string
          org_id?: string | null
          source_integration?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kb_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_approvals: {
        Row: {
          created_at: string
          id: string
          note: string | null
          org_id: string | null
          payload: Json
          requested_by: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          tool: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          org_id?: string | null
          payload?: Json
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tool: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          org_id?: string | null
          payload?: Json
          requested_by?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          tool?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_approvals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_approvals_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_approvals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mcp_approvals_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_tokens: {
        Row: {
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          token_prefix: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          token_prefix?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          metadata: Json
          org_id: string | null
          reactions: Json
          tenant_id: string
          thread_id: string | null
          user_id: string | null
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          reactions?: Json
          tenant_id?: string
          thread_id?: string | null
          user_id?: string | null
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          metadata?: Json
          org_id?: string | null
          reactions?: Json
          tenant_id?: string
          thread_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          app: string
          body: string | null
          created_at: string
          id: string
          metadata: Json
          org_id: string | null
          severity: string | null
          title: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          app: string
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          severity?: string | null
          title: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          app?: string
          body?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          org_id?: string | null
          severity?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      org_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          org_id: string
          restricted: boolean
          role: Database["public"]["Enums"]["app_role"]
          status: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          restricted?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          restricted?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
        }
        Relationships: []
      }
      org_members: {
        Row: {
          created_at: string
          id: string
          org_id: string
          permission: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          permission?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          permission?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      org_memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      org_usage: {
        Row: {
          active_agents_count: number
          contacts_count: number
          created_at: string
          id: string
          knowledge_docs_count: number
          month: string
          org_id: string
          seats_used: number
          social_posts_this_month: number
          updated_at: string
          vision_messages_used: number
        }
        Insert: {
          active_agents_count?: number
          contacts_count?: number
          created_at?: string
          id?: string
          knowledge_docs_count?: number
          month?: string
          org_id: string
          seats_used?: number
          social_posts_this_month?: number
          updated_at?: string
          vision_messages_used?: number
        }
        Update: {
          active_agents_count?: number
          contacts_count?: number
          created_at?: string
          id?: string
          knowledge_docs_count?: number
          month?: string
          org_id?: string
          seats_used?: number
          social_posts_this_month?: number
          updated_at?: string
          vision_messages_used?: number
        }
        Relationships: []
      }
      orgs: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          drive_folder_id: string | null
          exempt_reason: string | null
          id: string
          is_active: boolean
          is_exempt: boolean
          logo_url: string | null
          metadata: Json
          name: string
          org_type: string | null
          pipeline_stages: Json
          priorities: Json
          relationship_label: string | null
          role_label: string | null
          shared_drive_connected_at: string | null
          shared_drive_id: string | null
          shared_drive_name: string | null
          short_name: string | null
          slug: string
          stage_labels: Json
          status: string
          subscription_status: string
          subscription_tier: string
          success_definition: string | null
          success_metric: string | null
          tenant_id: string
          timezone: string
          trial_ends_at: string
        }
        Insert: {
          color: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          drive_folder_id?: string | null
          exempt_reason?: string | null
          id?: string
          is_active?: boolean
          is_exempt?: boolean
          logo_url?: string | null
          metadata?: Json
          name: string
          org_type?: string | null
          pipeline_stages?: Json
          priorities?: Json
          relationship_label?: string | null
          role_label?: string | null
          shared_drive_connected_at?: string | null
          shared_drive_id?: string | null
          shared_drive_name?: string | null
          short_name?: string | null
          slug: string
          stage_labels?: Json
          status?: string
          subscription_status?: string
          subscription_tier?: string
          success_definition?: string | null
          success_metric?: string | null
          tenant_id?: string
          timezone?: string
          trial_ends_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          drive_folder_id?: string | null
          exempt_reason?: string | null
          id?: string
          is_active?: boolean
          is_exempt?: boolean
          logo_url?: string | null
          metadata?: Json
          name?: string
          org_type?: string | null
          pipeline_stages?: Json
          priorities?: Json
          relationship_label?: string | null
          role_label?: string | null
          shared_drive_connected_at?: string | null
          shared_drive_id?: string | null
          shared_drive_name?: string | null
          short_name?: string | null
          slug?: string
          stage_labels?: Json
          status?: string
          subscription_status?: string
          subscription_tier?: string
          success_definition?: string | null
          success_metric?: string | null
          tenant_id?: string
          timezone?: string
          trial_ends_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orgs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_prefs: Json
          avatar_url: string | null
          card_theme: string
          company: string | null
          created_at: string
          custom_links: Json
          display_name: string | null
          email: string
          exempt_reason: string | null
          exempt_set_at: string | null
          google_access_token: string | null
          google_granted_scopes: string | null
          google_refresh_token: string | null
          id: string
          is_exempt: boolean
          is_restricted: boolean
          linkedin_url: string | null
          notification_prefs: Json
          onboarding_completed: boolean
          phone: string | null
          preferences: Json
          preferred_name: string | null
          primary_org_id: string | null
          scheduling_prefs: Json
          tagline: string | null
          timezone: string | null
          title: string | null
          updated_at: string
          username: string | null
          voice_profile: string | null
          website_url: string | null
        }
        Insert: {
          ai_prefs?: Json
          avatar_url?: string | null
          card_theme?: string
          company?: string | null
          created_at?: string
          custom_links?: Json
          display_name?: string | null
          email: string
          exempt_reason?: string | null
          exempt_set_at?: string | null
          google_access_token?: string | null
          google_granted_scopes?: string | null
          google_refresh_token?: string | null
          id: string
          is_exempt?: boolean
          is_restricted?: boolean
          linkedin_url?: string | null
          notification_prefs?: Json
          onboarding_completed?: boolean
          phone?: string | null
          preferences?: Json
          preferred_name?: string | null
          primary_org_id?: string | null
          scheduling_prefs?: Json
          tagline?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          username?: string | null
          voice_profile?: string | null
          website_url?: string | null
        }
        Update: {
          ai_prefs?: Json
          avatar_url?: string | null
          card_theme?: string
          company?: string | null
          created_at?: string
          custom_links?: Json
          display_name?: string | null
          email?: string
          exempt_reason?: string | null
          exempt_set_at?: string | null
          google_access_token?: string | null
          google_granted_scopes?: string | null
          google_refresh_token?: string | null
          id?: string
          is_exempt?: boolean
          is_restricted?: boolean
          linkedin_url?: string | null
          notification_prefs?: Json
          onboarding_completed?: boolean
          phone?: string | null
          preferences?: Json
          preferred_name?: string | null
          primary_org_id?: string | null
          scheduling_prefs?: Json
          tagline?: string | null
          timezone?: string | null
          title?: string | null
          updated_at?: string
          username?: string | null
          voice_profile?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_org_id_fkey"
            columns: ["primary_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_primary_org_id_fkey"
            columns: ["primary_org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          emoji: string | null
          id: string
          is_archived: boolean
          name: string
          org_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name: string
          org_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_order?: number
          emoji?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          org_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      social_ai_prompts: {
        Row: {
          brand: string
          id: string
          pillars: Json
          require_approval: boolean
          updated_at: string
          voice_notes: string | null
        }
        Insert: {
          brand: string
          id?: string
          pillars?: Json
          require_approval?: boolean
          updated_at?: string
          voice_notes?: string | null
        }
        Update: {
          brand?: string
          id?: string
          pillars?: Json
          require_approval?: boolean
          updated_at?: string
          voice_notes?: string | null
        }
        Relationships: []
      }
      social_analytics: {
        Row: {
          analysis: Json
          brand: string
          created_at: string
          created_by: string | null
          date_range_end: string | null
          date_range_start: string | null
          id: string
          platform: string
          raw_input: string | null
        }
        Insert: {
          analysis?: Json
          brand: string
          created_at?: string
          created_by?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          platform: string
          raw_input?: string | null
        }
        Update: {
          analysis?: Json
          brand?: string
          created_at?: string
          created_by?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          id?: string
          platform?: string
          raw_input?: string | null
        }
        Relationships: []
      }
      social_campaigns: {
        Row: {
          brand: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          metadata: Json
          name: string
          start_date: string | null
        }
        Insert: {
          brand: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          name: string
          start_date?: string | null
        }
        Update: {
          brand?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          metadata?: Json
          name?: string
          start_date?: string | null
        }
        Relationships: []
      }
      social_comment_replies: {
        Row: {
          author: string | null
          comment_text: string | null
          created_at: string
          external_comment_id: string | null
          id: string
          platform: string
          post_id: string | null
          reply_text: string | null
          status: string
        }
        Insert: {
          author?: string | null
          comment_text?: string | null
          created_at?: string
          external_comment_id?: string | null
          id?: string
          platform: string
          post_id?: string | null
          reply_text?: string | null
          status?: string
        }
        Update: {
          author?: string | null
          comment_text?: string | null
          created_at?: string
          external_comment_id?: string | null
          id?: string
          platform?: string
          post_id?: string | null
          reply_text?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_comment_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_integrations: {
        Row: {
          avatar_url: string | null
          connected_at: string | null
          created_at: string
          credentials: Json
          display_name: string | null
          follower_count: number | null
          id: string
          metadata: Json
          platform: string
          scopes: string[] | null
          status: string
          token_expires_at: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          connected_at?: string | null
          created_at?: string
          credentials?: Json
          display_name?: string | null
          follower_count?: number | null
          id?: string
          metadata?: Json
          platform: string
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          connected_at?: string | null
          created_at?: string
          credentials?: Json
          display_name?: string | null
          follower_count?: number | null
          id?: string
          metadata?: Json
          platform?: string
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      social_platform_tokens: {
        Row: {
          access_token: string
          account_avatar_url: string | null
          account_id: string | null
          account_name: string | null
          account_type: string | null
          account_username: string | null
          brand: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          platform: string
          refresh_token: string | null
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          account_avatar_url?: string | null
          account_id?: string | null
          account_name?: string | null
          account_type?: string | null
          account_username?: string | null
          brand?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          platform: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          account_avatar_url?: string | null
          account_id?: string | null
          account_name?: string | null
          account_type?: string | null
          account_username?: string | null
          brand?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          platform?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      social_posts: {
        Row: {
          ai_generated: boolean
          assigned_to: string | null
          brand: string
          caption: string | null
          content_pillar: string | null
          created_at: string
          created_by: string | null
          external_post_id: string | null
          format: string | null
          hashtags: Json
          hook: string | null
          id: string
          media_url: string | null
          metadata: Json
          platform: string
          published_at: string | null
          scheduled_at: string | null
          script_outline: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          assigned_to?: string | null
          brand: string
          caption?: string | null
          content_pillar?: string | null
          created_at?: string
          created_by?: string | null
          external_post_id?: string | null
          format?: string | null
          hashtags?: Json
          hook?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json
          platform: string
          published_at?: string | null
          scheduled_at?: string | null
          script_outline?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          assigned_to?: string | null
          brand?: string
          caption?: string | null
          content_pillar?: string | null
          created_at?: string
          created_by?: string | null
          external_post_id?: string | null
          format?: string | null
          hashtags?: Json
          hook?: string | null
          id?: string
          media_url?: string | null
          metadata?: Json
          platform?: string
          published_at?: string | null
          scheduled_at?: string | null
          script_outline?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_team_members: {
        Row: {
          color: string
          created_at: string
          id: string
          initials: string
          name: string
          permissions: Json
          role: string
          user_id: string | null
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          initials: string
          name: string
          permissions?: Json
          role: string
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          initials?: string
          name?: string
          permissions?: Json
          role?: string
          user_id?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      task_activity: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          metadata: Json
          org_id: string
          task_id: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          org_id: string
          task_id: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          org_id?: string
          task_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_activity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          drive_file_id: string | null
          id: string
          name: string
          org_id: string | null
          source: string
          task_id: string
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          drive_file_id?: string | null
          id?: string
          name: string
          org_id?: string | null
          source?: string
          task_id: string
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          drive_file_id?: string | null
          id?: string
          name?: string
          org_id?: string | null
          source?: string
          task_id?: string
          url?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          org_id: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          org_id?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          org_id?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sections: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_collapsed: boolean
          name: string
          org_id: string | null
          project_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_collapsed?: boolean
          name: string
          org_id?: string | null
          project_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_collapsed?: boolean
          name?: string
          org_id?: string | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_sections_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_at: string | null
          estimate_mins: number | null
          id: string
          org_id: string | null
          parent_task_id: string | null
          priority: string | null
          project_id: string | null
          section_id: string | null
          sort_order: number
          start_date: string | null
          status: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          estimate_mins?: number | null
          id?: string
          org_id?: string | null
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          section_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          title: string
        }
        Update: {
          assignee_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_at?: string | null
          estimate_mins?: number | null
          id?: string
          org_id?: string | null
          parent_task_id?: string | null
          priority?: string | null
          project_id?: string | null
          section_id?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "task_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_users: {
        Row: {
          created_at: string
          id: string
          invited_at: string | null
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_at?: string | null
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_at?: string | null
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_pool_limit: number
          created_at: string
          id: string
          name: string
          plan: string
          seats: number
          slug: string
          status: string
          trial_ends_at: string
        }
        Insert: {
          ai_pool_limit?: number
          created_at?: string
          id?: string
          name: string
          plan?: string
          seats?: number
          slug: string
          status?: string
          trial_ends_at?: string
        }
        Update: {
          ai_pool_limit?: number
          created_at?: string
          id?: string
          name?: string
          plan?: string
          seats?: number
          slug?: string
          status?: string
          trial_ends_at?: string
        }
        Relationships: []
      }
      user_integration_secrets: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          provider: string
          refresh_token: string | null
          token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          provider: string
          refresh_token?: string | null
          token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          provider?: string
          refresh_token?: string | null
          token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      visi_agent_runs: {
        Row: {
          agent_id: string | null
          created_at: string | null
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          make_execution_id: string | null
          output_summary: string | null
          started_at: string | null
          status: string | null
          tenant_id: string
          triggered_by: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          make_execution_id?: string | null
          output_summary?: string | null
          started_at?: string | null
          status?: string | null
          tenant_id?: string
          triggered_by?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          make_execution_id?: string | null
          output_summary?: string | null
          started_at?: string | null
          status?: string | null
          tenant_id?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visi_agent_runs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "visi_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visi_agent_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visi_agents: {
        Row: {
          ai_prompt: string | null
          assigned_to: string[] | null
          brand: string[] | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_prebuilt: boolean | null
          last_run_at: string | null
          last_run_status: string | null
          make_scenario_id: string | null
          make_scenario_url: string | null
          name: string
          run_count: number | null
          template_key: string | null
          tenant_id: string
          trigger_config: Json | null
          trigger_type: string | null
          updated_at: string | null
        }
        Insert: {
          ai_prompt?: string | null
          assigned_to?: string[] | null
          brand?: string[] | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_prebuilt?: boolean | null
          last_run_at?: string | null
          last_run_status?: string | null
          make_scenario_id?: string | null
          make_scenario_url?: string | null
          name: string
          run_count?: number | null
          template_key?: string | null
          tenant_id?: string
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_prompt?: string | null
          assigned_to?: string[] | null
          brand?: string[] | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_prebuilt?: boolean | null
          last_run_at?: string | null
          last_run_status?: string | null
          make_scenario_id?: string | null
          make_scenario_url?: string | null
          name?: string
          run_count?: number | null
          template_key?: string | null
          tenant_id?: string
          trigger_config?: Json | null
          trigger_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visi_agents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      visi_migration_tasks: {
        Row: {
          created_at: string | null
          id: string
          make_scenario_id: string | null
          notes: string | null
          status: string | null
          updated_at: string | null
          workflow_description: string | null
          workflow_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          make_scenario_id?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          workflow_description?: string | null
          workflow_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          make_scenario_id?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          workflow_description?: string | null
          workflow_name?: string
        }
        Relationships: []
      }
      visi_settings: {
        Row: {
          brief_time: string
          brief_to_channel: boolean
          brief_to_inbox: boolean
          display_name: string
          id: string
          is_secret: boolean | null
          key: string
          persona_description: string | null
          tone: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          brief_time?: string
          brief_to_channel?: boolean
          brief_to_inbox?: boolean
          display_name?: string
          id?: string
          is_secret?: boolean | null
          key: string
          persona_description?: string | null
          tone?: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          brief_time?: string
          brief_to_channel?: boolean
          brief_to_inbox?: boolean
          display_name?: string
          id?: string
          is_secret?: boolean | null
          key?: string
          persona_description?: string | null
          tone?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: []
      }
      vision_conversations: {
        Row: {
          active_org_id: string | null
          active_persona: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_org_id?: string | null
          active_persona?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_org_id?: string | null
          active_persona?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vision_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          feedback: string | null
          id: string
          persona: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          persona?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          persona?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "vision_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          org_count: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          org_count?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          org_count?: string | null
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      orgs_public: {
        Row: {
          color: string | null
          id: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          color?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          color?: string | null
          id?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          card_theme: string | null
          company: string | null
          custom_links: Json | null
          display_name: string | null
          id: string | null
          linkedin_url: string | null
          primary_org_id: string | null
          tagline: string | null
          title: string | null
          username: string | null
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          card_theme?: string | null
          company?: string | null
          custom_links?: Json | null
          display_name?: string | null
          id?: string | null
          linkedin_url?: string | null
          primary_org_id?: string | null
          tagline?: string | null
          title?: string | null
          username?: string | null
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          card_theme?: string | null
          company?: string | null
          custom_links?: Json | null
          display_name?: string | null
          id?: string | null
          linkedin_url?: string | null
          primary_org_id?: string | null
          tagline?: string | null
          title?: string | null
          username?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_primary_org_id_fkey"
            columns: ["primary_org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_primary_org_id_fkey"
            columns: ["primary_org_id"]
            isOneToOne: false
            referencedRelation: "orgs_public"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      current_tenant_id: { Args: never; Returns: string }
      default_tenant_id: { Args: never; Returns: string }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      ensure_org_usage: { Args: { _org_id: string }; Returns: undefined }
      get_my_profile_private: {
        Args: never
        Returns: {
          ai_prefs: Json
          display_name: string
          email: string
          google_access_token: string
          google_granted_scopes: string
          google_refresh_token: string
          id: string
          is_restricted: boolean
          notification_prefs: Json
          phone: string
          preferences: Json
          scheduling_prefs: Json
          voice_profile: string
        }[]
      }
      get_org_full: {
        Args: { _org_id: string }
        Returns: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          drive_folder_id: string | null
          exempt_reason: string | null
          id: string
          is_active: boolean
          is_exempt: boolean
          logo_url: string | null
          metadata: Json
          name: string
          org_type: string | null
          pipeline_stages: Json
          priorities: Json
          relationship_label: string | null
          role_label: string | null
          shared_drive_connected_at: string | null
          shared_drive_id: string | null
          shared_drive_name: string | null
          short_name: string | null
          slug: string
          stage_labels: Json
          status: string
          subscription_status: string
          subscription_tier: string
          success_definition: string | null
          success_metric: string | null
          tenant_id: string
          timezone: string
          trial_ends_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orgs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_org_members: {
        Args: { _org_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          email: string
          is_restricted: boolean
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_vision_usage: { Args: { _org_id: string }; Returns: undefined }
      is_exempt_user: { Args: never; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner_anywhere: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_super_admin:
        | { Args: never; Returns: boolean }
        | { Args: { _user_id: string }; Returns: boolean }
      list_owned_orgs_full: {
        Args: never
        Returns: {
          color: string
          created_at: string
          created_by: string | null
          description: string | null
          display_order: number
          drive_folder_id: string | null
          exempt_reason: string | null
          id: string
          is_active: boolean
          is_exempt: boolean
          logo_url: string | null
          metadata: Json
          name: string
          org_type: string | null
          pipeline_stages: Json
          priorities: Json
          relationship_label: string | null
          role_label: string | null
          shared_drive_connected_at: string | null
          shared_drive_id: string | null
          shared_drive_name: string | null
          short_name: string | null
          slug: string
          stage_labels: Json
          status: string
          subscription_status: string
          subscription_tier: string
          success_definition: string | null
          success_metric: string | null
          tenant_id: string
          timezone: string
          trial_ends_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orgs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      mcp_token_lookup: { Args: { _hash: string }; Returns: string }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_tenant_ids: { Args: never; Returns: string[] }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recount_org_usage: { Args: { _org_id: string }; Returns: undefined }
      search_kb_text: {
        Args: {
          match_count?: number
          org_filter?: string
          query_text: string
          user_filter?: string
        }
        Returns: {
          content: string
          document_id: string
          document_title: string
          id: string
          rank: number
        }[]
      }
    }
    Enums: {
      app_role: "owner" | "admin" | "member"
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
      app_role: ["owner", "admin", "member"],
    },
  },
} as const

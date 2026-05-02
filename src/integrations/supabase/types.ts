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
        ]
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
        ]
      }
      contacts: {
        Row: {
          company: string | null
          created_at: string
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
        }
        Insert: {
          company?: string | null
          created_at?: string
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
        }
        Update: {
          company?: string | null
          created_at?: string
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
        }
        Relationships: [
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
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
            foreignKeyName: "event_types_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          attendees: Json
          created_at: string
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
        }
        Insert: {
          attendees?: Json
          created_at?: string
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
        }
        Update: {
          attendees?: Json
          created_at?: string
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
            foreignKeyName: "events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        ]
      }
      kb_documents: {
        Row: {
          category: string
          created_at: string
          description: string | null
          error_message: string | null
          file_path: string | null
          file_type: string | null
          id: string
          org_id: string | null
          source_type: string
          source_url: string | null
          status: string
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
          file_path?: string | null
          file_type?: string | null
          id?: string
          org_id?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
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
          file_path?: string | null
          file_type?: string | null
          id?: string
          org_id?: string | null
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          word_count?: number | null
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
          org_id: string | null
          reactions: Json
          thread_id: string | null
          user_id: string | null
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          org_id?: string | null
          reactions?: Json
          thread_id?: string | null
          user_id?: string | null
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          org_id?: string | null
          reactions?: Json
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
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
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
            foreignKeyName: "org_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          color: string
          created_at: string
          id: string
          metadata: Json
          name: string
          slug: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          metadata?: Json
          name: string
          slug: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          metadata?: Json
          name?: string
          slug?: string
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
          google_access_token: string | null
          google_granted_scopes: string | null
          google_refresh_token: string | null
          id: string
          linkedin_url: string | null
          notification_prefs: Json
          phone: string | null
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
          google_access_token?: string | null
          google_granted_scopes?: string | null
          google_refresh_token?: string | null
          id: string
          linkedin_url?: string | null
          notification_prefs?: Json
          phone?: string | null
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
          google_access_token?: string | null
          google_granted_scopes?: string | null
          google_refresh_token?: string | null
          id?: string
          linkedin_url?: string | null
          notification_prefs?: Json
          phone?: string | null
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
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          org_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          org_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
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
        ]
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
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
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
          status: string | null
          title: string
        }
        Insert: {
          assignee_id?: string | null
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
          status?: string | null
          title: string
        }
        Update: {
          assignee_id?: string | null
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
          status?: string | null
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
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_owner_anywhere: { Args: { _user_id: string }; Returns: boolean }
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

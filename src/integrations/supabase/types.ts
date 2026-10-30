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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          metadata: Json
          subject: string | null
          success: boolean
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          subject?: string | null
          success?: boolean
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          subject?: string | null
          success?: boolean
        }
        Relationships: []
      }
      admin_auth_attempts: {
        Row: {
          attempt_count: number
          blocked_until: string | null
          ip_hash: string
          last_attempt_at: string
          lockout_level: number
          window_started_at: string
        }
        Insert: {
          attempt_count?: number
          blocked_until?: string | null
          ip_hash: string
          last_attempt_at?: string
          lockout_level?: number
          window_started_at?: string
        }
        Update: {
          attempt_count?: number
          blocked_until?: string | null
          ip_hash?: string
          last_attempt_at?: string
          lockout_level?: number
          window_started_at?: string
        }
        Relationships: []
      }
      asset_migration_inventory: {
        Row: {
          actual_mime: string | null
          actual_size: number | null
          asset_id: string
          declared_size: number | null
          expected_mime: string
          failure_reason: string | null
          height: number | null
          manifest_path: string
          migration_status: string
          original_filename: string | null
          sha256: string | null
          source_origin: string
          source_url: string
          storage_key: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          actual_mime?: string | null
          actual_size?: number | null
          asset_id: string
          declared_size?: number | null
          expected_mime: string
          failure_reason?: string | null
          height?: number | null
          manifest_path: string
          migration_status?: string
          original_filename?: string | null
          sha256?: string | null
          source_origin: string
          source_url: string
          storage_key?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          actual_mime?: string | null
          actual_size?: number | null
          asset_id?: string
          declared_size?: number | null
          expected_mime?: string
          failure_reason?: string | null
          height?: number | null
          manifest_path?: string
          migration_status?: string
          original_filename?: string | null
          sha256?: string | null
          source_origin?: string
          source_url?: string
          storage_key?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: []
      }
      clients: {
        Row: {
          created_at: string
          created_by: string | null
          display_as_text: boolean
          id: string
          is_visible: boolean
          logo_alt: string | null
          logo_path: string | null
          name: string
          position: number
          show_on_clients_page: boolean
          show_on_home: boolean
          slug: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_as_text?: boolean
          id?: string
          is_visible?: boolean
          logo_alt?: string | null
          logo_path?: string | null
          name: string
          position?: number
          show_on_clients_page?: boolean
          show_on_home?: boolean
          slug: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_as_text?: boolean
          id?: string
          is_visible?: boolean
          logo_alt?: string | null
          logo_path?: string | null
          name?: string
          position?: number
          show_on_clients_page?: boolean
          show_on_home?: boolean
          slug?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      contact_submissions: {
        Row: {
          attachment_paths: Json
          budget: string | null
          company: string | null
          created_at: string
          email: string
          id: string
          internal_notes: string | null
          links: Json
          message: string
          name: string
          request_type: string
          source_ip_hash: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attachment_paths?: Json
          budget?: string | null
          company?: string | null
          created_at?: string
          email: string
          id?: string
          internal_notes?: string | null
          links?: Json
          message: string
          name: string
          request_type: string
          source_ip_hash?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attachment_paths?: Json
          budget?: string | null
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          internal_notes?: string | null
          links?: Json
          message?: string
          name?: string
          request_type?: string
          source_ip_hash?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_revisions: {
        Row: {
          action: string
          actor_id: string | null
          after_snapshot: Json
          before_snapshot: Json | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          note: string | null
          publish_revision: number | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          after_snapshot: Json
          before_snapshot?: Json | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          note?: string | null
          publish_revision?: number | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          after_snapshot?: Json
          before_snapshot?: Json | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          note?: string | null
          publish_revision?: number | null
        }
        Relationships: []
      }
      disciplines: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          items: Json
          name: string
          position: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          items?: Json
          name: string
          position?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          items?: Json
          name?: string
          position?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          message_type: string
          next_attempt_at: string
          payload: Json
          recipient: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          message_type: string
          next_attempt_at?: string
          payload?: Json
          recipient: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          message_type?: string
          next_attempt_at?: string
          payload?: Json
          recipient?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      experience_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          organisation: string
          period: string | null
          position: number
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          organisation: string
          period?: string | null
          position?: number
          role: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          organisation?: string
          period?: string | null
          position?: number
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_assets: {
        Row: {
          alt_text: string | null
          bucket_id: string
          byte_size: number
          caption: string | null
          content_type: string
          created_at: string
          height: number | null
          id: string
          is_public: boolean
          object_path: string
          original_name: string | null
          sha256: string | null
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bucket_id: string
          byte_size: number
          caption?: string | null
          content_type: string
          created_at?: string
          height?: number | null
          id?: string
          is_public?: boolean
          object_path: string
          original_name?: string | null
          sha256?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bucket_id?: string
          byte_size?: number
          caption?: string | null
          content_type?: string
          created_at?: string
          height?: number | null
          id?: string
          is_public?: boolean
          object_path?: string
          original_name?: string | null
          sha256?: string | null
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: []
      }
      metrics: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          label: string
          note: string | null
          position: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          label: string
          note?: string | null
          position?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          label?: string
          note?: string | null
          position?: number
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmed_at: string | null
          consent_text_version: string
          created_at: string
          email: string
          id: string
          requested_at: string
          status: string
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          consent_text_version: string
          created_at?: string
          email: string
          id?: string
          requested_at?: string
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          consent_text_version?: string
          created_at?: string
          email?: string
          id?: string
          requested_at?: string
          status?: string
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          purpose: string
          subscriber_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          purpose: string
          subscriber_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          subscriber_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_tokens_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "newsletter_subscribers"
            referencedColumns: ["id"]
          },
        ]
      }
      page_sections: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_visible: boolean
          page_id: string
          position: number
          section_key: string
          section_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          page_id: string
          position?: number
          section_key: string
          section_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          page_id?: string
          position?: number
          section_key?: string
          section_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_sections_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          canonical_url: string | null
          created_at: string
          created_by: string | null
          id: string
          locale: string
          og_image_path: string | null
          published_at: string | null
          route_path: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          og_image_path?: string | null
          published_at?: string | null
          route_path?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          locale?: string
          og_image_path?: string | null
          published_at?: string | null
          route_path?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      principles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      process_steps: {
        Row: {
          created_at: string
          description: string
          id: string
          is_published: boolean
          number_label: string | null
          position: number
          step_key: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          number_label?: string | null
          position?: number
          step_key: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_published?: boolean
          number_label?: string | null
          position?: number
          step_key?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_content: {
        Row: {
          address: string | null
          biography: string | null
          created_at: string
          headline: string | null
          id: string
          intro: string | null
          is_published: boolean
          location: string | null
          name: string
          phone: string | null
          portrait_path: string | null
          public_email: string | null
          role: string | null
          roles: string[]
          singleton_key: string
          socials: Json
          updated_at: string
          updated_by: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          biography?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          intro?: string | null
          is_published?: boolean
          location?: string | null
          name?: string
          phone?: string | null
          portrait_path?: string | null
          public_email?: string | null
          role?: string | null
          roles?: string[]
          singleton_key?: string
          socials?: Json
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          biography?: string | null
          created_at?: string
          headline?: string | null
          id?: string
          intro?: string | null
          is_published?: boolean
          location?: string | null
          name?: string
          phone?: string | null
          portrait_path?: string | null
          public_email?: string | null
          role?: string | null
          roles?: string[]
          singleton_key?: string
          socials?: Json
          updated_at?: string
          updated_by?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          challenge: string | null
          client_id: string | null
          client_label: string | null
          cover_alt: string | null
          cover_path: string | null
          created_at: string
          created_by: string | null
          discipline: string | null
          featured: boolean
          gallery: Json
          hue: number
          id: string
          idea: string | null
          locale: string
          outcome: string | null
          position: number
          project_type: string | null
          published_at: string | null
          slug: string
          status: string
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
          year_label: string | null
        }
        Insert: {
          challenge?: string | null
          client_id?: string | null
          client_label?: string | null
          cover_alt?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          featured?: boolean
          gallery?: Json
          hue?: number
          id?: string
          idea?: string | null
          locale?: string
          outcome?: string | null
          position?: number
          project_type?: string | null
          published_at?: string | null
          slug: string
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          year_label?: string | null
        }
        Update: {
          challenge?: string | null
          client_id?: string | null
          client_label?: string | null
          cover_alt?: string | null
          cover_path?: string | null
          created_at?: string
          created_by?: string | null
          discipline?: string | null
          featured?: boolean
          gallery?: Json
          hue?: number
          id?: string
          idea?: string | null
          locale?: string
          outcome?: string | null
          position?: number
          project_type?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          year_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string
          details: Json
          id: string
          is_published: boolean
          line: string | null
          number_label: string | null
          position: number
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          details?: Json
          id?: string
          is_published?: boolean
          line?: string | null
          number_label?: string | null
          position?: number
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          details?: Json
          id?: string
          is_published?: boolean
          line?: string | null
          number_label?: string | null
          position?: number
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_publication_state: {
        Row: {
          published_at: string
          published_by: string | null
          published_revision: number
          singleton_key: string
        }
        Insert: {
          published_at?: string
          published_by?: string | null
          published_revision?: number
          singleton_key?: string
        }
        Update: {
          published_at?: string
          published_by?: string | null
          published_revision?: number
          singleton_key?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          created_at: string
          id: string
          is_public: boolean
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_public?: boolean
          setting_key: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_public?: boolean
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          category: string | null
          created_at: string
          id: string
          is_published: boolean
          level: string | null
          name: string
          position: number
          tier: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          level?: string | null
          name: string
          position?: number
          tier?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          level?: string | null
          name?: string
          position?: number
          tier?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: []
      }
      slug_redirects: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          new_slug: string
          old_slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          new_slug: string
          old_slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          new_slug?: string
          old_slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_site_admin: { Args: never; Returns: boolean }
      register_admin_auth_attempt: {
        Args: { p_ip_hash: string; p_now: string }
        Returns: {
          attempt_count: number
          blocked_until: string
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
    Enums: {},
  },
} as const

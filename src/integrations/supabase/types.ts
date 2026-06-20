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
      manager_permissions: {
        Row: {
          can_manage_logistics: boolean
          can_manage_orders: boolean
          can_manage_pos: boolean
          can_manage_products: boolean
          can_manage_stock: boolean
          can_manage_users: boolean
          can_view_accounting: boolean
          notes: string | null
          pos_ids: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_logistics?: boolean
          can_manage_orders?: boolean
          can_manage_pos?: boolean
          can_manage_products?: boolean
          can_manage_stock?: boolean
          can_manage_users?: boolean
          can_view_accounting?: boolean
          notes?: string | null
          pos_ids?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_logistics?: boolean
          can_manage_orders?: boolean
          can_manage_pos?: boolean
          can_manage_products?: boolean
          can_manage_stock?: boolean
          can_manage_users?: boolean
          can_view_accounting?: boolean
          notes?: string | null
          pos_ids?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_expenses: {
        Row: {
          amount_fcfa: number
          amount_usd: number
          city_scope: string
          created_at: string
          id: string
          note: string
          reported_by: string
          spent_at: string
        }
        Insert: {
          amount_fcfa?: number
          amount_usd?: number
          city_scope: string
          created_at?: string
          id?: string
          note: string
          reported_by: string
          spent_at?: string
        }
        Update: {
          amount_fcfa?: number
          amount_usd?: number
          city_scope?: string
          created_at?: string
          id?: string
          note?: string
          reported_by?: string
          spent_at?: string
        }
        Relationships: []
      }
      wholesale_sales: {
        Row: {
          city_scope: string
          created_at: string
          created_by: string
          customer_name: string
          customer_phone: string | null
          id: string
          notes: string | null
          payment_status: string
          product_id: string | null
          product_name: string
          quantity: number
          sold_at: string
          total_fcfa: number
          total_usd: number
          unit_price_fcfa: number
          unit_price_usd: number
        }
        Insert: {
          city_scope: string
          created_at?: string
          created_by: string
          customer_name: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_status?: string
          product_id?: string | null
          product_name: string
          quantity?: number
          sold_at?: string
          total_fcfa?: number
          total_usd?: number
          unit_price_fcfa?: number
          unit_price_usd?: number
        }
        Update: {
          city_scope?: string
          created_at?: string
          created_by?: string
          customer_name?: string
          customer_phone?: string | null
          id?: string
          notes?: string | null
          payment_status?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sold_at?: string
          total_fcfa?: number
          total_usd?: number
          unit_price_fcfa?: number
          unit_price_usd?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          assigned_to: string | null
          city: string
          city_scope: string | null
          commune: string
          country_code: string
          country_name: string
          created_at: string
          customer_name: string
          customer_phone: string
          delivery_date: string | null
          delivery_time: string | null
          delivered_at: string | null
          id: string
          items: Json
          notes: string | null
          order_number: string
          status: Database["public"]["Enums"]["order_status"]
          total_fcfa: number
          total_usd: number
          updated_at: string
        }
        Insert: {
          address: string
          assigned_to?: string | null
          city: string
          city_scope?: string | null
          commune: string
          country_code: string
          country_name: string
          created_at?: string
          customer_name: string
          customer_phone: string
          delivery_date?: string | null
          delivery_time?: string | null
          delivered_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_fcfa?: number
          total_usd?: number
          updated_at?: string
        }
        Update: {
          address?: string
          assigned_to?: string | null
          city?: string
          city_scope?: string | null
          commune?: string
          country_code?: string
          country_name?: string
          created_at?: string
          customer_name?: string
          customer_phone?: string
          delivery_date?: string | null
          delivery_time?: string | null
          delivered_at?: string | null
          id?: string
          items?: Json
          notes?: string | null
          order_number?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_fcfa?: number
          total_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      points_of_sale: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      pos_accounts: {
        Row: {
          created_at: string
          pos_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          pos_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          pos_id?: string
          user_id?: string
        }
        Relationships: []
      }
      pos_sales: {
        Row: {
          created_at: string
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          payment_method: string
          pos_id: string
          sold_by: string
          total_fcfa: number
          total_usd: number
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          payment_method?: string
          pos_id: string
          sold_by: string
          total_fcfa?: number
          total_usd?: number
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          payment_method?: string
          pos_id?: string
          sold_by?: string
          total_fcfa?: number
          total_usd?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_bestseller: boolean
          name: string
          price_fcfa: number
          price_usd: number
          quantity: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_bestseller?: boolean
          name: string
          price_fcfa?: number
          price_usd?: number
          quantity?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_bestseller?: boolean
          name?: string
          price_fcfa?: number
          price_usd?: number
          quantity?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          badge_id: string | null
          city_scope: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          badge_id?: string | null
          city_scope?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          badge_id?: string | null
          city_scope?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          after_image_url: string | null
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          author_name: string
          before_image_url: string | null
          comment: string
          created_at: string
          id: string
          location: string | null
          product_slug: string
          rating: number
        }
        Insert: {
          after_image_url?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          author_name: string
          before_image_url?: string | null
          comment: string
          created_at?: string
          id?: string
          location?: string | null
          product_slug: string
          rating: number
        }
        Update: {
          after_image_url?: string | null
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          author_name?: string
          before_image_url?: string | null
          comment?: string
          created_at?: string
          id?: string
          location?: string | null
          product_slug?: string
          rating?: number
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          cta_href: string
          cta_label: string
          hero_eyebrow: string
          hero_highlight: string
          hero_images: string[]
          hero_subtitle: string
          hero_title: string
          id: boolean
          updated_at: string
          updated_by: string | null
          whatsapp_number: string
        }
        Insert: {
          cta_href?: string
          cta_label?: string
          hero_eyebrow?: string
          hero_highlight?: string
          hero_images?: string[]
          hero_subtitle?: string
          hero_title?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string
        }
        Update: {
          cta_href?: string
          cta_label?: string
          hero_eyebrow?: string
          hero_highlight?: string
          hero_images?: string[]
          hero_subtitle?: string
          hero_title?: string
          id?: boolean
          updated_at?: string
          updated_by?: string | null
          whatsapp_number?: string
        }
        Relationships: []
      }
      stock: {
        Row: {
          id: string
          low_stock_threshold: number
          pos_id: string | null
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          id?: string
          low_stock_threshold?: number
          pos_id?: string | null
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          id?: string
          low_stock_threshold?: number
          pos_id?: string | null
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_pos_id_fkey"
            columns: ["pos_id"]
            isOneToOne: false
            referencedRelation: "points_of_sale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          pos_id: string | null
          product_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          pos_id?: string | null
          product_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          pos_id?: string | null
          product_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_pos_id_fkey"
            columns: ["pos_id"]
            isOneToOne: false
            referencedRelation: "points_of_sale"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      app_role: "admin" | "manager" | "livreur" | "client" | "pos"
      order_status:
        | "received"
        | "preparing"
        | "ready"
        | "en_route"
        | "delivered"
        | "cancelled"
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
      app_role: ["admin", "manager", "livreur", "client", "pos"],
      order_status: [
        "received",
        "preparing",
        "ready",
        "en_route",
        "delivered",
        "cancelled",
      ],
    },
  },
} as const

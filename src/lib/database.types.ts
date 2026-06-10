export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      arrangement_recipes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          photo: string | null
          updated_at: string
          user_id: string
          website_price: number
          website_url: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          photo?: string | null
          updated_at?: string
          user_id: string
          website_price?: number
          website_url?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          photo?: string | null
          updated_at?: string
          user_id?: string
          website_price?: number
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arrangement_recipes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_signups: {
        Row: {
          created_at: string
          email: string
          id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      beta_feedback: {
        Row: {
          created_at: string
          email: string
          feedback: string
          id: string
          timestamp: string
        }
        Insert: {
          created_at?: string
          email: string
          feedback: string
          id?: string
          timestamp?: string
        }
        Update: {
          created_at?: string
          email?: string
          feedback?: string
          id?: string
          timestamp?: string
        }
        Relationships: []
      }
      markup_settings: {
        Row: {
          accessory: number
          id: string
          other: number
          stem: number
          updated_at: string
          user_id: string
          vase: number
        }
        Insert: {
          accessory?: number
          id?: string
          other?: number
          stem?: number
          updated_at?: string
          user_id: string
          vase?: number
        }
        Update: {
          accessory?: number
          id?: string
          other?: number
          stem?: number
          updated_at?: string
          user_id?: string
          vase?: number
        }
        Relationships: [
          {
            foreignKeyName: "markup_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_products: {
        Row: {
          id: string
          name: string
          order_id: string
          quantity: number
          type: Database["public"]["Enums"]["product_type"]
          wholesale_cost: number
        }
        Insert: {
          id?: string
          name: string
          order_id: string
          quantity?: number
          type: Database["public"]["Enums"]["product_type"]
          wholesale_cost: number
        }
        Update: {
          id?: string
          name?: string
          order_id?: string
          quantity?: number
          type?: Database["public"]["Enums"]["product_type"]
          wholesale_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_products_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          photo: string | null
          profit: number
          staff_id: string | null
          staff_name: string | null
          total_retail: number
          total_wholesale: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          photo?: string | null
          profit: number
          staff_id?: string | null
          staff_name?: string | null
          total_retail: number
          total_wholesale: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          photo?: string | null
          profit?: number
          staff_id?: string | null
          staff_name?: string | null
          total_retail?: number
          total_wholesale?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_settings: {
        Row: {
          id: string
          is_configured: boolean
          store_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          id?: string
          is_configured?: boolean
          store_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          id?: string
          is_configured?: boolean
          store_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          created_at: string
          id: string
          inventory_count: number | null
          last_used: string
          low_stock_threshold: number | null
          name: string
          type: Database["public"]["Enums"]["product_type"]
          user_id: string
          wholesale_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_count?: number | null
          last_used?: string
          low_stock_threshold?: number | null
          name: string
          type: Database["public"]["Enums"]["product_type"]
          user_id: string
          wholesale_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          inventory_count?: number | null
          last_used?: string
          low_stock_threshold?: number | null
          name?: string
          type?: Database["public"]["Enums"]["product_type"]
          user_id?: string
          wholesale_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          store_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          store_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          store_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      recipe_ingredients: {
        Row: {
          id: string
          name: string
          notes: string | null
          quantity: number
          recipe_id: string
          type: Database["public"]["Enums"]["product_type"]
        }
        Insert: {
          id?: string
          name: string
          notes?: string | null
          quantity?: number
          recipe_id: string
          type: Database["public"]["Enums"]["product_type"]
        }
        Update: {
          id?: string
          name?: string
          notes?: string | null
          quantity?: number
          recipe_id?: string
          type?: Database["public"]["Enums"]["product_type"]
        }
        Relationships: [
          {
            foreignKeyName: "recipe_ingredients_recipe_id_fkey"
            columns: ["recipe_id"]
            isOneToOne: false
            referencedRelation: "arrangement_recipes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      product_type: "stem" | "vase" | "accessory" | "other"
      user_role: "owner" | "manager" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never
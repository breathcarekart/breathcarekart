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
      activity_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          description: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: NonNullable<Json>
        }
        ComputedFields: never
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: NonNullable<Json>
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          description?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: NonNullable<Json>
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          email: string | null
          gstin: string | null
          id: boolean
          invoice_prefix: string
          invoice_terms: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          company_name: string
          email?: string | null
          gstin?: string | null
          id?: boolean
          invoice_prefix?: string
          invoice_terms?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string
          email?: string | null
          gstin?: string | null
          id?: boolean
          invoice_prefix?: string
          invoice_terms?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          age: number | null
          alternate_phones: string[]
          attender_name: string | null
          attender_relation: string | null
          city: string | null
          created_at: string
          created_by: string | null
          customer_since: string
          emergency_contact: string | null
          gender: string | null
          id: string
          legacy_ref: string | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          whatsapp: string | null
        }
        ComputedFields: never
        Insert: {
          address?: string | null
          age?: number | null
          alternate_phones?: string[]
          attender_name?: string | null
          attender_relation?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          customer_since?: string
          emergency_contact?: string | null
          gender?: string | null
          id?: string
          legacy_ref?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          age?: number | null
          alternate_phones?: string[]
          attender_name?: string | null
          attender_relation?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          customer_since?: string
          emergency_contact?: string | null
          gender?: string | null
          id?: string
          legacy_ref?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_photos: {
        Row: {
          created_at: string
          id: string
          rental_id: string
          storage_path: string
          uploaded_by: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          rental_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          rental_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_photos_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_types: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      equipment_units: {
        Row: {
          available_for: string
          brand: string | null
          created_at: string
          created_by: string | null
          daily_rate: number | null
          equipment_type_id: string
          id: string
          model: string | null
          monthly_rate: number | null
          notes: string | null
          purchase_date: string | null
          sale_price: number | null
          serial_number: string | null
          status: Database["public"]["Enums"]["equipment_status"]
          unit_code: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          available_for?: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate?: number | null
          equipment_type_id: string
          id?: string
          model?: string | null
          monthly_rate?: number | null
          notes?: string | null
          purchase_date?: string | null
          sale_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          unit_code?: string | null
          updated_at?: string
        }
        Update: {
          available_for?: string
          brand?: string | null
          created_at?: string
          created_by?: string | null
          daily_rate?: number | null
          equipment_type_id?: string
          id?: string
          model?: string | null
          monthly_rate?: number | null
          notes?: string | null
          purchase_date?: string | null
          sale_price?: number | null
          serial_number?: string | null
          status?: Database["public"]["Enums"]["equipment_status"]
          unit_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_units_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_units_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_counters: {
        Row: {
          last_number: number
          year: number
        }
        ComputedFields: never
        Insert: {
          last_number?: number
          year: number
        }
        Update: {
          last_number?: number
          year?: number
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          equipment_unit_id: string | null
          id: string
          invoice_id: string
          quantity: number
          rate: number
          rental_period: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          description: string
          equipment_unit_id?: string | null
          id?: string
          invoice_id: string
          quantity?: number
          rate: number
          rental_period?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          equipment_unit_id?: string | null
          id?: string
          invoice_id?: string
          quantity?: number
          rate?: number
          rental_period?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_equipment_unit_id_fkey"
            columns: ["equipment_unit_id"]
            isOneToOne: false
            referencedRelation: "equipment_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string | null
          customer_id: string
          discount: number
          due_date: string
          grand_total: number
          id: string
          invoice_date: string
          invoice_number: string
          notes: string | null
          period_end: string | null
          period_start: string | null
          rental_id: string | null
          sale_id: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          tax_rate: number
          transaction_type: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id: string
          discount?: number
          due_date: string
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          rental_id?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          transaction_type?: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string
          discount?: number
          due_date?: string
          grand_total?: number
          id?: string
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          period_end?: string | null
          period_start?: string | null
          rental_id?: string | null
          sale_id?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          tax_rate?: number
          transaction_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_id: string | null
          legacy_ref: string | null
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          payment_date: string
          period_end: string | null
          period_start: string | null
          recorded_by: string | null
          reference_no: string | null
          rental_id: string | null
        }
        ComputedFields: never
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          legacy_ref?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          rental_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_id?: string | null
          legacy_ref?: string | null
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          payment_date?: string
          period_end?: string | null
          period_start?: string | null
          recorded_by?: string | null
          reference_no?: string | null
          rental_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      rental_items: {
        Row: {
          created_at: string
          description: string | null
          equipment_type_id: string | null
          equipment_unit_id: string | null
          id: string
          quantity: number
          rate: number | null
          rate_type: string
          rental_id: string
          returned_at: string | null
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description?: string | null
          equipment_type_id?: string | null
          equipment_unit_id?: string | null
          id?: string
          quantity?: number
          rate?: number | null
          rate_type?: string
          rental_id: string
          returned_at?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          equipment_type_id?: string | null
          equipment_unit_id?: string | null
          id?: string
          quantity?: number
          rate?: number | null
          rate_type?: string
          rental_id?: string
          returned_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rental_items_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_items_equipment_unit_id_fkey"
            columns: ["equipment_unit_id"]
            isOneToOne: false
            referencedRelation: "equipment_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rental_items_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          delivered_at: string | null
          delivery_notes: string | null
          delivery_status: string
          deposit_amount: number
          due_date: string
          id: string
          legacy_ref: string | null
          notes: string | null
          rental_number: string
          returned_date: string | null
          start_date: string
          status: Database["public"]["Enums"]["rental_status"]
          supervisor_id: string | null
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string
          deposit_amount?: number
          due_date: string
          id?: string
          legacy_ref?: string | null
          notes?: string | null
          rental_number: string
          returned_date?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          delivered_at?: string | null
          delivery_notes?: string | null
          delivery_status?: string
          deposit_amount?: number
          due_date?: string
          id?: string
          legacy_ref?: string | null
          notes?: string | null
          rental_number?: string
          returned_date?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"]
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          description: string
          equipment_type_id: string | null
          equipment_unit_id: string | null
          id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          description: string
          equipment_type_id?: string | null
          equipment_unit_id?: string | null
          id?: string
          quantity?: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          description?: string
          equipment_type_id?: string | null
          equipment_unit_id?: string | null
          id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_equipment_type_id_fkey"
            columns: ["equipment_type_id"]
            isOneToOne: false
            referencedRelation: "equipment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_equipment_unit_id_fkey"
            columns: ["equipment_unit_id"]
            isOneToOne: false
            referencedRelation: "equipment_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          sale_date: string
          sale_number: string
          status: string
          updated_at: string
        }
        ComputedFields: never
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          sale_date?: string
          sale_number: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          sale_date?: string
          sale_number?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_rental_supervisor: {
        Args: { p_rental_id: string; p_supervisor_id: string }
        Returns: undefined
      }
      can_see_rental: { Args: { p_rental_id: string }; Returns: boolean }
      create_invoice: { Args: { p: Json }; Returns: Json }
      current_app_role: { Args: Record<PropertyKey, never>; Returns: string }
      delivery_photo_rental_id: { Args: { p_name: string }; Returns: string }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_office: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_staff: { Args: Record<PropertyKey, never>; Returns: boolean }
      is_supervisor: { Args: Record<PropertyKey, never>; Returns: boolean }
      log_activity: {
        Args: {
          p_action: string
          p_description: string
          p_entity_id: string
          p_entity_type: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      next_invoice_number: { Args: { p_date: string }; Returns: string }
      record_payment: {
        Args: {
          p_amount: number
          p_invoice_id: string
          p_method: Database["public"]["Enums"]["payment_method"]
          p_notes?: string
          p_payment_date?: string
          p_reference?: string
        }
        Returns: string
      }
      renew_rental: {
        Args: { p_new_due_date: string; p_rental_id: string }
        Returns: undefined
      }
      return_rental: {
        Args: { p_rental_id: string; p_returned_date?: string }
        Returns: undefined
      }
      set_delivery_status: {
        Args: { p_notes?: string; p_rental_id: string; p_status: string }
        Returns: undefined
      }
    }
    Enums: {
      equipment_status:
        | "available"
        | "reserved"
        | "on_rent"
        | "maintenance"
        | "repair"
        | "sold"
      invoice_status: "draft" | "pending" | "paid" | "overdue" | "cancelled"
      payment_method:
        | "cash"
        | "upi"
        | "card"
        | "bank_transfer"
        | "cheque"
        | "other"
        | "unknown"
      rental_status:
        | "active"
        | "due_soon"
        | "overdue"
        | "completed"
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
      equipment_status: [
        "available",
        "reserved",
        "on_rent",
        "maintenance",
        "repair",
        "sold",
      ],
      invoice_status: ["draft", "pending", "paid", "overdue", "cancelled"],
      payment_method: [
        "cash",
        "upi",
        "card",
        "bank_transfer",
        "cheque",
        "other",
        "unknown",
      ],
      rental_status: [
        "active",
        "due_soon",
        "overdue",
        "completed",
        "cancelled",
      ],
    },
  },
} as const

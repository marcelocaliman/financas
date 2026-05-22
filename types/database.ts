/**
 * Tipos do banco Supabase.
 *
 * Este arquivo será regenerado por `pnpm db:types` após cada migration:
 *   supabase gen types typescript --linked > types/database.generated.ts
 *
 * Até lá, mantemos um shape mínimo compatível com supabase-js.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type AccountType =
  | "checking"
  | "savings"
  | "credit_card"
  | "investment"
  | "cash";

export type CategoryKind = "income" | "expense" | "transfer";
export type TransactionKind = "income" | "expense" | "transfer";
export type PaymentMethod = "credit" | "debit" | "pix" | "cash" | "auto_debit" | "transfer";
export type CategorySource = "manual" | "rule" | "ai";
export type TransferDirection = "in" | "out";
export type AssetType =
  | "fii"
  | "fixed_income_public"
  | "fixed_income_private"
  | "stock"
  | "etf"
  | "crypto";
export type Indexer = "selic" | "cdi" | "ipca" | "fixed" | "none";
export type IndexerCode = "selic" | "cdi" | "ipca";
export type TaxRegime = "regressive" | "exempt";
export type YieldSource = "manual" | "calculated" | "imported";
export type MovementKind = "buy" | "sell" | "dividend" | "split";
export type YieldRuleMode = "reinvest" | "fixed_amount" | "percentage";
export type RedemptionStatus = "pending" | "executed" | "skipped";
export type PhysicalAssetCategory =
  | "real_estate"
  | "vehicle"
  | "electronics"
  | "furniture"
  | "jewelry"
  | "art"
  | "tools"
  | "other";
export type DepreciationMethod = "none" | "linear";

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          household_id: string;
          display_name: string;
          role: "admin" | "member";
          created_at: string;
        };
        Insert: {
          id: string;
          household_id: string;
          display_name: string;
          role?: "admin" | "member";
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          display_name?: string;
          role?: "admin" | "member";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "users_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      accounts: {
        Row: {
          id: string;
          household_id: string;
          institution: string;
          type: AccountType;
          name: string;
          color: string | null;
          current_balance: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          institution: string;
          type: AccountType;
          name: string;
          color?: string | null;
          current_balance?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          institution?: string;
          type?: AccountType;
          name?: string;
          color?: string | null;
          current_balance?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          icon: string | null;
          color: string | null;
          parent_id: string | null;
          rules: Json;
          kind: CategoryKind;
          sort_order: number;
          is_archived: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          icon?: string | null;
          color?: string | null;
          parent_id?: string | null;
          rules?: Json;
          kind: CategoryKind;
          sort_order?: number;
          is_archived?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          name?: string;
          icon?: string | null;
          color?: string | null;
          parent_id?: string | null;
          rules?: Json;
          kind?: CategoryKind;
          sort_order?: number;
          is_archived?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          household_id: string;
          account_id: string;
          category_id: string | null;
          kind: TransactionKind;
          amount: number;
          description: string;
          payment_method: PaymentMethod | null;
          date: string;
          created_by: string;
          category_source: CategorySource;
          category_confidence: number | null;
          transfer_pair_id: string | null;
          transfer_direction: TransferDirection | null;
          is_recurring: boolean;
          recurring_rule_id: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          account_id: string;
          category_id?: string | null;
          kind: TransactionKind;
          amount: number;
          description: string;
          payment_method?: PaymentMethod | null;
          date: string;
          created_by: string;
          category_source?: CategorySource;
          category_confidence?: number | null;
          transfer_pair_id?: string | null;
          transfer_direction?: TransferDirection | null;
          is_recurring?: boolean;
          recurring_rule_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          account_id?: string;
          category_id?: string | null;
          kind?: TransactionKind;
          amount?: number;
          description?: string;
          payment_method?: PaymentMethod | null;
          date?: string;
          created_by?: string;
          category_source?: CategorySource;
          category_confidence?: number | null;
          transfer_pair_id?: string | null;
          transfer_direction?: TransferDirection | null;
          is_recurring?: boolean;
          recurring_rule_id?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      indexer_history: {
        Row: {
          indexer: IndexerCode;
          date: string;
          value: number;
          source: string;
          created_at: string;
        };
        Insert: {
          indexer: IndexerCode;
          date: string;
          value: number;
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["indexer_history"]["Insert"]>;
        Relationships: [];
      };
      physical_assets: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          category: PhysicalAssetCategory;
          description: string | null;
          acquired_at: string | null;
          acquired_value: number;
          current_value: number;
          depreciation_method: DepreciationMethod;
          depreciation_years: number | null;
          metadata: Json;
          is_active: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          category: PhysicalAssetCategory;
          description?: string | null;
          acquired_at?: string | null;
          acquired_value?: number;
          current_value: number;
          depreciation_method?: DepreciationMethod;
          depreciation_years?: number | null;
          metadata?: Json;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["physical_assets"]["Insert"]>;
        Relationships: [];
      };
      quote_snapshots: {
        Row: {
          ticker: string;
          price: number;
          change_pct: number | null;
          long_name: string | null;
          currency: string | null;
          fetched_at: string;
        };
        Insert: {
          ticker: string;
          price: number;
          change_pct?: number | null;
          long_name?: string | null;
          currency?: string | null;
          fetched_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quote_snapshots"]["Insert"]>;
        Relationships: [];
      };
      investments: {
        Row: {
          id: string;
          household_id: string;
          account_id: string;
          ticker: string;
          name: string;
          asset_type: AssetType;
          indexer: Indexer | null;
          indexer_multiplier: number | null;
          fixed_rate: number | null;
          purchase_date: string;
          initial_amount: number;
          current_balance: number;
          quantity: number | null;
          tax_regime: TaxRegime;
          is_active: boolean;
          last_yield_at: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          account_id: string;
          ticker: string;
          name: string;
          asset_type: AssetType;
          indexer?: Indexer | null;
          indexer_multiplier?: number | null;
          fixed_rate?: number | null;
          purchase_date: string;
          initial_amount: number;
          current_balance?: number;
          tax_regime?: TaxRegime;
          is_active?: boolean;
          last_yield_at?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "investments_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "investments_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_movements: {
        Row: {
          id: string;
          household_id: string;
          investment_id: string;
          kind: MovementKind;
          date: string;
          quantity: number;
          unit_price: number;
          total_amount: number;
          fees: number;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          investment_id: string;
          kind: MovementKind;
          date: string;
          quantity: number;
          unit_price: number;
          fees?: number;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investment_movements"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "investment_movements_investment_id_fkey";
            columns: ["investment_id"];
            isOneToOne: false;
            referencedRelation: "investments";
            referencedColumns: ["id"];
          },
        ];
      };
      investment_yields: {
        Row: {
          id: string;
          investment_id: string;
          household_id: string;
          month: string;
          gross_yield: number;
          tax: number;
          net_yield: number;
          source: YieldSource;
          created_at: string;
        };
        Insert: {
          id?: string;
          investment_id: string;
          household_id: string;
          month: string;
          gross_yield: number;
          tax?: number;
          source?: YieldSource;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["investment_yields"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "investment_yields_investment_id_fkey";
            columns: ["investment_id"];
            isOneToOne: false;
            referencedRelation: "investments";
            referencedColumns: ["id"];
          },
        ];
      };
      yield_rules: {
        Row: {
          id: string;
          household_id: string;
          investment_id: string;
          destination_account_id: string;
          mode: YieldRuleMode;
          suggested_amount: number | null;
          percentage: number | null;
          day_of_month: number;
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          investment_id: string;
          destination_account_id: string;
          mode: YieldRuleMode;
          suggested_amount?: number | null;
          percentage?: number | null;
          day_of_month: number;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["yield_rules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "yield_rules_investment_id_fkey";
            columns: ["investment_id"];
            isOneToOne: false;
            referencedRelation: "investments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "yield_rules_destination_account_id_fkey";
            columns: ["destination_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      goals: {
        Row: {
          id: string;
          household_id: string;
          name: string;
          description: string | null;
          target_amount: number;
          current_amount: number;
          target_date: string | null;
          linked_account_id: string | null;
          is_archived: boolean;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          name: string;
          description?: string | null;
          target_amount: number;
          current_amount?: number;
          target_date?: string | null;
          linked_account_id?: string | null;
          is_archived?: boolean;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goals"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "goals_linked_account_id_fkey";
            columns: ["linked_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      redemption_intents: {
        Row: {
          id: string;
          household_id: string;
          yield_rule_id: string;
          due_date: string;
          status: RedemptionStatus;
          suggested_amount: number;
          executed_amount: number | null;
          transfer_pair_id: string | null;
          notes: string | null;
          decided_at: string | null;
          decided_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          yield_rule_id: string;
          due_date: string;
          status?: RedemptionStatus;
          suggested_amount: number;
          executed_amount?: number | null;
          transfer_pair_id?: string | null;
          notes?: string | null;
          decided_at?: string | null;
          decided_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["redemption_intents"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "redemption_intents_yield_rule_id_fkey";
            columns: ["yield_rule_id"];
            isOneToOne: false;
            referencedRelation: "yield_rules";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      bootstrap_household: {
        Args: { p_household_name: string; p_display_name: string };
        Returns: string;
      };
      seed_default_categories: {
        Args: { p_household_id: string };
        Returns: void;
      };
      current_household_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      create_transfer: {
        Args: {
          p_from_account_id: string;
          p_to_account_id: string;
          p_amount: number;
          p_date: string;
          p_description?: string | null;
        };
        Returns: string;
      };
      delete_transfer: {
        Args: { p_pair_id: string };
        Returns: void;
      };
      transaction_balance_delta: {
        Args: { p_kind: string; p_direction: string | null; p_amount: number };
        Returns: number;
      };
      selic_daily_rate: {
        Args: { p_annual_pct: number };
        Returns: number;
      };
      apply_daily_yield: {
        Args: { p_investment_id: string };
        Returns: number;
      };
      add_investment_movement: {
        Args: {
          p_investment_id: string;
          p_kind: MovementKind;
          p_date: string;
          p_quantity: number;
          p_unit_price: number;
          p_fees?: number;
          p_notes?: string | null;
        };
        Returns: string;
      };
      add_to_fixed_income: {
        Args: {
          p_investment_id: string;
          p_amount: number;
          p_date: string;
          p_debit_account_id?: string | null;
          p_notes?: string | null;
        };
        Returns: void;
      };
      ensure_pending_intents: {
        Args: { p_months_ahead?: number };
        Returns: number;
      };
      execute_redemption: {
        Args: { p_intent_id: string; p_amount: number };
        Returns: string;
      };
      skip_redemption: {
        Args: { p_intent_id: string };
        Returns: void;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Inserts<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type Updates<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

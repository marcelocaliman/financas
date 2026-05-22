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

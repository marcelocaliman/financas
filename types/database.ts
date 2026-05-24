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
export type Currency = "BRL" | "EUR" | "USD";

export type GoalType =
  | "emergencia"
  | "casa"
  | "veiculo"
  | "viagem"
  | "aposentadoria"
  | "educacao"
  | "projeto"
  | "outro";
export type GoalAllocationMode =
  | "manual"
  | "fixed_amount"
  | "percentage"
  | "waterfall";
export type GoalSourceType = "account" | "investment" | "manual";
export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Database {
  public: {
    Tables: {
      households: {
        Row: {
          id: string;
          name: string;
          subscription_tier: "free" | "pro" | "family" | "lifetime";
          subscription_status:
            | "active"
            | "trialing"
            | "past_due"
            | "cancelled"
            | "suspended";
          subscription_started_at: string | null;
          subscription_renews_at: string | null;
          trial_ends_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          created_by: string | null;
          suspended_reason: string | null;
          suspended_at: string | null;
          fire_target_monthly_income: number | null;
          fire_expected_return_pct: number | null;
          fire_inflation_pct: number | null;
          fire_swr_pct: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          subscription_tier?: "free" | "pro" | "family" | "lifetime";
          subscription_status?:
            | "active"
            | "trialing"
            | "past_due"
            | "cancelled"
            | "suspended";
          subscription_started_at?: string | null;
          subscription_renews_at?: string | null;
          trial_ends_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          created_by?: string | null;
          suspended_reason?: string | null;
          suspended_at?: string | null;
          fire_target_monthly_income?: number | null;
          fire_expected_return_pct?: number | null;
          fire_inflation_pct?: number | null;
          fire_swr_pct?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["households"]["Insert"]>;
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          household_id: string;
          display_name: string;
          role: "admin" | "member";
          preferences: Json;
          is_active: boolean;
          deactivated_at: string | null;
          deactivated_reason: string | null;
          birth_date: string | null;
          target_retirement_age: number | null;
          inss_monthly_estimate: number | null;
          created_at: string;
        };
        Insert: {
          id: string;
          household_id: string;
          display_name: string;
          role?: "admin" | "member";
          preferences?: Json;
          is_active?: boolean;
          deactivated_at?: string | null;
          deactivated_reason?: string | null;
          birth_date?: string | null;
          target_retirement_age?: number | null;
          inss_monthly_estimate?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          display_name?: string;
          role?: "admin" | "member";
          preferences?: Json;
          is_active?: boolean;
          deactivated_at?: string | null;
          deactivated_reason?: string | null;
          birth_date?: string | null;
          target_retirement_age?: number | null;
          inss_monthly_estimate?: number | null;
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
      currency_rates: {
        Row: {
          base: Currency;
          quote: Currency;
          date: string;
          rate: number;
          source: string;
          created_at: string;
        };
        Insert: {
          base: Currency;
          quote: Currency;
          date: string;
          rate: number;
          source?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["currency_rates"]["Insert"]>;
        Relationships: [];
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
          currency: Currency;
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
          currency?: Currency;
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
          currency?: Currency;
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
          amount_account: number;
          currency: Currency;
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
          /** Timestamp de quando o delta foi aplicado em accounts.current_balance.
           * Null = pendente (date ainda no futuro). Set pelo trigger BEFORE
           * INSERT/UPDATE quando date ≤ today (SP). */
          balance_applied_at: string | null;
          tags: string[];
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
          amount_account?: number;
          currency?: Currency;
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
          balance_applied_at?: string | null;
          tags?: string[];
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
          amount_account?: number;
          currency?: Currency;
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
          balance_applied_at?: string | null;
          tags?: string[];
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
          currency: Currency;
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
          currency?: Currency;
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
          currency: Currency;
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
          currency?: Currency;
          quantity?: number | null;
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
          currency: Currency;
          target_date: string | null;
          linked_account_id: string | null;
          is_archived: boolean;
          sort_order: number;
          goal_type: GoalType;
          priority: number;
          allocation_mode: GoalAllocationMode;
          allocation_value: number | null;
          contribution_day: number | null;
          tracking_starts_at: string | null;
          property_price: number | null;
          property_down_pct: number | null;
          property_closing_pct: number | null;
          loan_term_months: number | null;
          loan_annual_rate_pct: number | null;
          loan_system: "sac" | "price" | null;
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
          currency?: Currency;
          target_date?: string | null;
          linked_account_id?: string | null;
          is_archived?: boolean;
          sort_order?: number;
          goal_type?: GoalType;
          priority?: number;
          allocation_mode?: GoalAllocationMode;
          allocation_value?: number | null;
          contribution_day?: number | null;
          tracking_starts_at?: string | null;
          property_price?: number | null;
          property_down_pct?: number | null;
          property_closing_pct?: number | null;
          loan_term_months?: number | null;
          loan_annual_rate_pct?: number | null;
          loan_system?: "sac" | "price" | null;
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
      goal_sources: {
        Row: {
          id: string;
          goal_id: string;
          source_type: GoalSourceType;
          source_id: string | null;
          allocated_amount: number | null;
          allocated_pct: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          source_type: GoalSourceType;
          source_id?: string | null;
          allocated_amount?: number | null;
          allocated_pct?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goal_sources"]["Insert"]>;
        Relationships: [];
      };
      goal_contributions: {
        Row: {
          id: string;
          goal_id: string;
          date: string;
          amount: number;
          source: string;
          transaction_id: string | null;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          goal_id: string;
          date: string;
          amount: number;
          source?: string;
          transaction_id?: string | null;
          notes?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["goal_contributions"]["Insert"]>;
        Relationships: [];
      };
      category_budgets: {
        Row: {
          id: string;
          household_id: string;
          category_id: string;
          start_month: string;
          amount: number;
          currency: Currency;
          alert_threshold: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          category_id: string;
          start_month: string;
          amount: number;
          currency?: Currency;
          alert_threshold?: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["category_budgets"]["Insert"]>;
        Relationships: [];
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
      recurring_rules: {
        Row: {
          id: string;
          household_id: string;
          kind: TransactionKind;
          amount: number;
          currency: Currency;
          description: string;
          account_id: string | null;
          category_id: string | null;
          payment_method: PaymentMethod | null;
          from_account_id: string | null;
          to_account_id: string | null;
          frequency: RecurrenceFrequency;
          interval_count: number;
          day_of_month: number | null;
          day_of_week: number | null;
          start_date: string;
          end_date: string | null;
          is_active: boolean;
          last_materialized_date: string | null;
          notes: string | null;
          tags: string[];
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          kind: TransactionKind;
          amount: number;
          currency?: Currency;
          description: string;
          account_id?: string | null;
          category_id?: string | null;
          payment_method?: PaymentMethod | null;
          from_account_id?: string | null;
          to_account_id?: string | null;
          frequency: RecurrenceFrequency;
          interval_count?: number;
          day_of_month?: number | null;
          day_of_week?: number | null;
          start_date: string;
          end_date?: string | null;
          is_active?: boolean;
          last_materialized_date?: string | null;
          notes?: string | null;
          tags?: string[];
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recurring_rules"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "recurring_rules_household_id_fkey";
            columns: ["household_id"];
            isOneToOne: false;
            referencedRelation: "households";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_rules_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_rules_from_account_id_fkey";
            columns: ["from_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_rules_to_account_id_fkey";
            columns: ["to_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "recurring_rules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      patrimonio_snapshots: {
        Row: {
          id: string;
          household_id: string;
          month_end: string;
          liquid: number;
          fixed_income: number;
          variable_income: number;
          physical: number;
          credit_card_debt: number;
          total: number;
          currency: Currency;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          month_end: string;
          liquid?: number;
          fixed_income?: number;
          variable_income?: number;
          physical?: number;
          credit_card_debt?: number;
          total?: number;
          currency?: Currency;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["patrimonio_snapshots"]["Insert"]>;
        Relationships: [];
      };
      household_invites: {
        Row: {
          id: string;
          household_id: string;
          code: string;
          created_by: string;
          created_at: string;
          expires_at: string;
          used_at: string | null;
          used_by: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          household_id: string;
          code: string;
          created_by: string;
          created_at?: string;
          expires_at?: string;
          used_at?: string | null;
          used_by?: string | null;
          revoked_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["household_invites"]["Insert"]>;
        Relationships: [];
      };
      platform_admins: {
        Row: {
          user_id: string;
          granted_by: string | null;
          granted_at: string;
          notes: string | null;
        };
        Insert: {
          user_id: string;
          granted_by?: string | null;
          granted_at?: string;
          notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["platform_admins"]["Insert"]>;
        Relationships: [];
      };
      admin_audit_log: {
        Row: {
          id: string;
          admin_user_id: string;
          action: string;
          target_household_id: string | null;
          target_user_id: string | null;
          details: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          action: string;
          target_household_id?: string | null;
          target_user_id?: string | null;
          details?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_audit_log"]["Insert"]>;
        Relationships: [];
      };
      user_consents: {
        Row: {
          id: string;
          user_id: string;
          consent_type:
            | "terms_of_service"
            | "privacy_policy"
            | "data_processing"
            | "marketing_emails"
            | "analytics_cookies";
          version: string;
          granted: boolean;
          granted_at: string;
          revoked_at: string | null;
          ip_address: string | null;
          user_agent: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          consent_type:
            | "terms_of_service"
            | "privacy_policy"
            | "data_processing"
            | "marketing_emails"
            | "analytics_cookies";
          version: string;
          granted: boolean;
          granted_at?: string;
          revoked_at?: string | null;
          ip_address?: string | null;
          user_agent?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["user_consents"]["Insert"]>;
        Relationships: [];
      };
      feature_flags: {
        Row: {
          key: string;
          enabled: boolean;
          description: string | null;
          rollout_pct: number;
          enabled_for_tiers: string[];
          updated_by: string | null;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          description?: string | null;
          rollout_pct?: number;
          enabled_for_tiers?: string[];
          updated_by?: string | null;
          updated_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["feature_flags"]["Insert"]>;
        Relationships: [];
      };
      announcements: {
        Row: {
          id: string;
          title: string;
          body: string | null;
          severity: "info" | "warning" | "critical";
          starts_at: string | null;
          ends_at: string | null;
          dismissible: boolean;
          link_url: string | null;
          link_label: string | null;
          target_tier: "free" | "pro" | "family" | "lifetime" | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          body?: string | null;
          severity?: "info" | "warning" | "critical";
          starts_at?: string | null;
          ends_at?: string | null;
          dismissible?: boolean;
          link_url?: string | null;
          link_label?: string | null;
          target_tier?: "free" | "pro" | "family" | "lifetime" | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcements"]["Insert"]>;
        Relationships: [];
      };
      announcement_dismissals: {
        Row: {
          user_id: string;
          announcement_id: string;
          dismissed_at: string;
        };
        Insert: {
          user_id: string;
          announcement_id: string;
          dismissed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["announcement_dismissals"]["Insert"]>;
        Relationships: [];
      };
      system_settings: {
        Row: {
          key: string;
          value: Json;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: Json;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["system_settings"]["Insert"]>;
        Relationships: [];
      };
      data_access_requests: {
        Row: {
          id: string;
          user_id: string;
          request_type: "export" | "delete" | "rectify";
          status: "pending" | "in_progress" | "completed" | "rejected";
          requested_at: string;
          completed_at: string | null;
          result_payload: Json | null;
          admin_notes: string | null;
          handled_by: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          request_type: "export" | "delete" | "rectify";
          status?: "pending" | "in_progress" | "completed" | "rejected";
          requested_at?: string;
          completed_at?: string | null;
          result_payload?: Json | null;
          admin_notes?: string | null;
          handled_by?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["data_access_requests"]["Insert"]>;
        Relationships: [];
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
      is_platform_admin: {
        Args: { uid?: string };
        Returns: boolean;
      };
      admin_platform_stats: {
        Args: Record<string, never>;
        Returns: {
          total_households: number;
          total_users: number;
          active_subscriptions: number;
          trialing: number;
          suspended: number;
          pending_data_requests: number;
          new_households_7d: number;
          new_users_7d: number;
        }[];
      };
      admin_household_growth: {
        Args: { p_days?: number };
        Returns: { date: string; count: number }[];
      };
      admin_user_growth: {
        Args: { p_days?: number };
        Returns: { date: string; count: number }[];
      };
      admin_action_volume: {
        Args: { p_days?: number };
        Returns: { date: string; count: number }[];
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
      reset_household_data: {
        Args: Record<string, never>;
        Returns: void;
      };
      materialize_recurrence: {
        Args: { p_rule_id: string; p_until_date: string };
        Returns: number;
      };
      materialize_all_recurrences: {
        Args: { p_household_id: string; p_until_date: string };
        Returns: number;
      };
      next_recurrence_date: {
        Args: {
          p_start_date: string;
          p_frequency: RecurrenceFrequency;
          p_interval: number;
          p_day_of_month: number | null;
          p_day_of_week: number | null;
          p_from: string;
        };
        Returns: string;
      };
      generate_household_invite: {
        Args: Record<string, never>;
        Returns: string;
      };
      revoke_household_invite: {
        Args: { p_code: string };
        Returns: void;
      };
      redeem_household_invite: {
        Args: { p_code: string; p_display_name: string };
        Returns: string;
      };
      merge_categories: {
        Args: { p_source_id: string; p_target_id: string };
        Returns: void;
      };
      reorder_categories: {
        Args: { p_ids: string[] };
        Returns: void;
      };
      advance_pending_balances: {
        Args: Record<string, never>;
        Returns: number;
      };
      reorder_goals: {
        Args: { p_ids: string[] };
        Returns: void;
      };
      record_goal_contribution: {
        Args: {
          p_goal_id: string;
          p_amount: number;
          p_date?: string;
          p_source?: string;
          p_notes?: string | null;
          p_transaction_id?: string | null;
          p_bump_current?: boolean;
        };
        Returns: string;
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

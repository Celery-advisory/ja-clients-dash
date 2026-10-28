export type PortfolioBucket =
  | "income"
  | "growth"
  | "venture"
  | "treasury"
  | "coa";

export type UserRole = "advisor" | "client" | "admin";

export type TransactionType =
  | "drawdown"
  | "deposit"
  | "transfer"
  | "fee"
  | "other";

export type ClientStatus = "onboarding" | "active" | "review_due" | "inactive";

export type UpdateKind =
  | "report"
  | "portfolio"
  | "transaction"
  | "note"
  | "invite"
  | "general";

export type GoalStatus = "on-track" | "at-risk" | "ahead" | "in-progress";

export type ReviewCadence = "quarterly" | "semi_annual" | "annual";

export interface ClientGoal {
  id: string;
  client_id: string;
  name: string;
  category: string;
  icon_name: string;
  target_usd: number;
  current_usd: number;
  target_date: string | null;
  is_ongoing: boolean;
  probability_pct: number;
  status: GoalStatus;
  advisor_note: string;
  linked_bucket: PortfolioBucket | null;
  created_at: string;
  updated_at: string;
}

export interface WealthAdvisor {
  id: string;
  full_name: string;
  email: string;
  title: string | null;
  phone: string | null;
  is_admin: boolean;
  is_superadmin: boolean;
  is_active: boolean;
  auth_user_id: string | null;
  invited_at: string | null;
  bio: string | null;
  timezone: string | null;
  availability_notes: string | null;
  onboarding_completed_at: string | null;
  notify_sessions?: string;
  notify_documents?: string;
  notify_messages?: string;
  created_at?: string;
}

export interface AdvisorListRow extends WealthAdvisor {
  client_count: number;
  aum: number;
}

export interface WealthClient {
  id: string;
  client_number: string;
  reference_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  currency: string;
  inception_date: string | null;
  advisor_id: string | null;
  status: ClientStatus;
  risk_profile: string | null;
  investment_horizon: string | null;
  primary_objective: string | null;
  marital_status: string | null;
  dependents: number;
  estate_status: string | null;
  financial_goals: string | null;
  advisor_notes: string | null;
  date_of_birth: string | null;
  auth_user_id: string | null;
  invited_at: string | null;
  last_login_at: string | null;
  review_cadence: ReviewCadence | null;
  next_review_date: string | null;
  last_contact_date: string | null;
  risk_assessed_at: string | null;
  created_at?: string;
}

export interface ClientListRow extends WealthClient {
  aum: number;
  location: string | null;
}

export interface ClientAddress {
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal_code: string | null;
  country: string;
}

export interface StatementPeriod {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  label: string;
}

export interface PortfolioHolding {
  id: string;
  client_id: string;
  period_id: string | null;
  bucket: PortfolioBucket;
  investment_name: string;
  ticker: string;
  quantity: number | null;
  original_value_usd: number;
  market_value_usd: number;
  sort_order: number;
}

export interface PortfolioSnapshot {
  id: string;
  client_id: string;
  period_id: string;
  bucket: PortfolioBucket;
  previous_value_usd: number;
  current_value_usd: number;
  period_change_pct: number | null;
  ytd_pct: number | null;
  inception_gain_usd: number | null;
  inception_pct: number | null;
  annualized_return_pct: number | null;
}

export interface PortfolioHistoryPoint {
  recorded_on: string;
  total_value_usd: number;
}

export interface WealthTransaction {
  id: string;
  client_id: string;
  bucket: PortfolioBucket | null;
  occurred_on: string;
  amount_usd: number;
  description: string;
  transaction_type: TransactionType;
}

export interface WealthReport {
  id: string;
  client_id: string;
  period_id: string;
  reference: string;
  title: string;
  generated_at: string;
  storage_path: string;
  file_size_bytes: number | null;
  status: "draft" | "published" | "archived";
  sections: string[] | null;
  template_key: string | null;
  sent_at: string | null;
  cover_image_id?: string | null;
  published_at?: string | null;
  summary?: unknown;
  first_viewed_at?: string | null;
  last_viewed_at?: string | null;
  view_count?: number;
}

export interface WealthDisclaimer {
  version: string;
  title: string;
  body: string;
}

export interface ClientUpdate {
  id: string;
  client_id: string;
  kind: UpdateKind;
  title: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface SessionProfile {
  id: string;
  role: UserRole;
  client_id: string | null;
  advisor_id: string | null;
  full_name: string | null;
  email: string;
  is_superadmin: boolean;
  email_notifications: boolean;
}

export const JOHN_DOE_CLIENT_ID = "c0000000-0000-4000-8000-000000000001";
export const JOHN_DOE_PERIOD_ID = "b0000000-0000-4000-8000-000000000007";

export const CLIENT_SELECT = `
  id, client_number, reference_code, full_name, email, phone, currency,
  inception_date::text, advisor_id, status::text, risk_profile,
  investment_horizon, primary_objective, marital_status, dependents,
  estate_status, financial_goals, advisor_notes, date_of_birth::text,
  auth_user_id, invited_at::text, last_login_at::text,
  review_cadence::text, next_review_date::text, last_contact_date::text,
  risk_assessed_at::text, created_at::text
`;

export interface OutreachStatus {
  running: boolean;
  pid: number | null;
  started_at?: string | null;
  sending_paused?: string | null;
}

export interface BrainStatus {
  provider?: string;
  status?: string;
  reason?: string;
  since?: string;
  kind?: string;
}

export interface PipelineStats {
  prospects?: {
    total: number;
    by_status: Record<string, number>;
  };
  campaigns?: {
    total: number;
    by_status: Record<string, number>;
  };
  conversations?: {
    total: number;
    by_status: Record<string, number>;
  };
  pipeline?: Record<string, number>;
  actions_total?: number;
  claude_calls_today?: number;
  codex_calls_today?: number;
  deepseek_calls_today?: number;
  brain_provider?: string;
  brain_status?: BrainStatus;
}

export interface TodayItem {
  key: string;
  tone: "bad" | "warn" | "info" | "good";
  title: string;
  detail: string;
  action?: string;
  tab?: string;
  url?: string;
  url_label?: string;
}

export interface TodayStats {
  companies: number;
  prospects: number;
  signals_confirmed: number;
  outbox_pending: number;
  outbox_approved: number;
  open_conversations: number;
  needs_human: number;
  signals_proposed: number;
  email_provider?: string;
  unprofiled?: number;
}

export interface TodayResponse {
  items: TodayItem[];
  stats: TodayStats;
}

export interface Company {
  id: string;
  name: string;
  domain: string;
  industry?: string;
  location?: string;
  website?: string;
  fit?: number;
  contact_count?: number;
  created_at?: string;
}

export interface Prospect {
  id: string;
  company_id?: string;
  company_name?: string;
  company?: string;
  domain?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  title: string;
  linkedin_url?: string;
  status: string;
  stage?: string;
  email_status?: "verified" | "guess" | "catch_all" | "invalid" | string;
  email_verified?: boolean;
  score?: number;
  created_at?: string;
}

export interface DecisionMaker {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  title: string;
  role_priority?: number | null;
  email: string;
  email_status?: "verified" | "deliverable" | "guess" | "risky" | string;
  email_match_confidence?: number;
  evidence?: string;
  linkedin_url?: string;
  twitter_url?: string;
  github_url?: string;
  company_id?: string;
  company_name: string;
  company_domain: string;
  website?: string;
  industry?: string;
  location?: string;
  status?: string;
  created_at?: string;
}

export interface OutboxItem {
  id: string;
  prospect_id?: string;
  prospect_name?: string;
  to_email: string;
  company_name?: string;
  company_domain?: string;
  subject: string;
  body: string;
  status: "pending_review" | "approved" | "scheduled" | "sending" | "sent" | "rejected" | "failed" | string;
  score?: number;
  tip?: string;
  kind?: string;
  step?: number;
  sent_at?: string;
  created_at?: string;
}

export interface Conversation {
  id: string;
  prospect_id?: string;
  first_name?: string;
  last_name?: string;
  prospect_email?: string;
  company?: string;
  subject?: string;
  status: "open" | "needs_human" | "closed" | "closed_won" | "closed_lost" | string;
  stage?: string;
  intent?: "interested" | "question" | "objection" | "not_interested" | "ooo" | "unsubscribe" | string;
  updated_at?: string;
  thread?: any[];
  emails?: any[];
}

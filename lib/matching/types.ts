// Mirrors math_engine/*.py's data shapes. math_engine stays around as a Python CLI
// for offline experimentation, but this TS port is what actually runs in production
// (Vercel's serverless functions have no Python runtime to shell out to).

export interface StartupInput {
  name: string;
  verticals: string[];
  stage: string | null;
  targetRaise: number | null;
  description: string;
  location: string | null;
}

export interface VerticalFocusRow {
  preferred_stage: string | null;
  typical_check_size: number | null;
  verticals: { vertical_name: string } | null;
}

export interface ContactInvestmentRow {
  company_name: string | null;
  description: string | null;
  relationship: string | null;
  investment_stage: string | null;
  year_partnered: number | null;
}

export interface Contact {
  id: string;
  name: string;
  role: string | null;
  linkedin_url: string | null;
  bio: string;
  org_id: string;
  org_name: string | null;
  typical_check_size: number | null;
  contact_verticals: string[];
  org_vertical_focus: VerticalFocusRow[];
  investments: ContactInvestmentRow[];
}

export interface ScoreBreakdown {
  vertical: number;
  stage: number;
  check_size: number;
  text: number;
}

export interface ScoredResult {
  contactId: string;
  contactName: string;
  orgName: string | null;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  rank: number;
}

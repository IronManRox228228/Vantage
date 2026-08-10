import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

export interface Plant {
  id: string;
  name: string;
  location: string;
  industry_type: string;
  created_at?: string;
  user_id?: string;
}

export interface Screen {
  id: string;
  plant_id: string;
  name: string;
  tag: string;
  description?: string;
  screen_type: 'overview' | 'unit' | 'detail' | 'alarm';
  created_at?: string;
  user_id?: string;
}

export interface AnalysisRun {
  id: string;
  plant_id?: string;
  screen_id?: string;
  timestamp: number | string;
  image_hash: string;
  risk_score: number;
  compliance_score: number;
  cognitive_load: number;
  metrics_snapshot: Record<string, any>;
  issues_count_by_severity: { high: number; medium: number; low: number };
  issues_count_by_category: Record<string, number>;
  issues: Array<{
    x: number;
    y: number;
    w: number;
    h: number;
    category: string;
    severity: 'high' | 'medium' | 'low';
    issue: string;
    recommendation: string;
    standard_ref: string;
  }>;
  detected_elements?: Record<string, any>;
  ai_model_version: string;
  thumbnail_url?: string;
  image_url?: string;
  user_id?: string;
}

export interface BatchRun {
  id: string;
  name: string;
  timestamp: number | string;
  total_screens: number;
  avg_risk: number;
  avg_compliance: number;
  screen_results: any[];
  user_id?: string;
}

-- =======================================================
-- Vantage HMI Auditor - Supabase Relational Schema
-- Migration: 20260810_init_vantage_schema.sql
-- =======================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------
-- 1. PLANTS TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.plants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    location TEXT DEFAULT 'Site A',
    industry_type TEXT DEFAULT 'General Industrial',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user & plant lookup
CREATE INDEX IF NOT EXISTS idx_plants_user_id ON public.plants(user_id);

-- Enable RLS for Plants
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own plants" 
ON public.plants 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------
-- 2. SCREENS TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.screens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    plant_id UUID REFERENCES public.plants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tag TEXT DEFAULT 'SCR-001',
    description TEXT DEFAULT '',
    screen_type TEXT DEFAULT 'overview', -- 'overview' | 'unit' | 'detail' | 'alarm'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for screen lookups
CREATE INDEX IF NOT EXISTS idx_screens_user_id ON public.screens(user_id);
CREATE INDEX IF NOT EXISTS idx_screens_plant_id ON public.screens(plant_id);

-- Enable RLS for Screens
ALTER TABLE public.screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own screens" 
ON public.screens 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------
-- 3. ANALYSIS RUNS TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
    screen_id UUID REFERENCES public.screens(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    image_hash TEXT DEFAULT '',
    risk_score INT NOT NULL,
    compliance_score INT NOT NULL,
    cognitive_load INT NOT NULL,
    metrics_snapshot JSONB DEFAULT '{}'::jsonb,
    issues_count_by_severity JSONB DEFAULT '{"high": 0, "medium": 0, "low": 0}'::jsonb,
    issues_count_by_category JSONB DEFAULT '{}'::jsonb,
    issues JSONB DEFAULT '[]'::jsonb,
    detected_elements JSONB DEFAULT '{}'::jsonb,
    ai_model_version TEXT DEFAULT 'Gemini 3.1 Flash Lite',
    thumbnail_url TEXT DEFAULT '',
    image_url TEXT DEFAULT ''
);

-- Indexes for analysis runs analytics & lookups
CREATE INDEX IF NOT EXISTS idx_analysis_runs_user_id ON public.analysis_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_plant_id ON public.analysis_runs(plant_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_screen_id ON public.analysis_runs(screen_id);
CREATE INDEX IF NOT EXISTS idx_analysis_runs_timestamp ON public.analysis_runs(timestamp DESC);

-- Enable RLS for Analysis Runs
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own analysis runs" 
ON public.analysis_runs 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------
-- 4. BATCH RUNS TABLE
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.batch_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    name TEXT NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    total_screens INT DEFAULT 0,
    avg_risk NUMERIC DEFAULT 0,
    avg_compliance NUMERIC DEFAULT 0,
    screen_results JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_batch_runs_user_id ON public.batch_runs(user_id);

-- Enable RLS for Batch Runs
ALTER TABLE public.batch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own batch runs" 
ON public.batch_runs 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- -------------------------------------------------------
-- 5. STORAGE BUCKET SETUP (hmi-screenshots)
-- -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('hmi-screenshots', 'hmi-screenshots', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'hmi-screenshots' AND auth.uid() = owner);

CREATE POLICY "Users can view screenshots"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'hmi-screenshots');

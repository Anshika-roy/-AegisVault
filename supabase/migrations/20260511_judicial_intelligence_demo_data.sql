-- AegisVault - Judicial intelligence demo tables and sample metrics.
-- The metrics in this migration are seeded demo data for hackathon review.

CREATE TABLE IF NOT EXISTS public.judicial_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judge_name TEXT NOT NULL,
  court_name TEXT NOT NULL,
  bench TEXT DEFAULT 'Single Bench',
  domain TEXT NOT NULL,
  total_cases_analyzed INTEGER DEFAULT 0,
  injunction_grant_rate NUMERIC DEFAULT 0,
  avg_disposal_days INTEGER DEFAULT 0,
  dismissal_rate NUMERIC DEFAULT 0,
  settlement_rate NUMERIC DEFAULT 0,
  appeal_overturn_rate NUMERIC DEFAULT 0,
  notable_precedents TEXT[] DEFAULT '{}',
  specialization_score NUMERIC DEFAULT 0,
  data_period TEXT DEFAULT '2020-2024',
  last_updated TIMESTAMPTZ DEFAULT now(),
  UNIQUE (judge_name, court_name, domain)
);

ALTER TABLE public.judicial_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read judicial intelligence" ON public.judicial_intelligence;
CREATE POLICY "Anyone can read judicial intelligence"
  ON public.judicial_intelligence FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon can read judicial intelligence" ON public.judicial_intelligence;
CREATE POLICY "Anon can read judicial intelligence"
  ON public.judicial_intelligence FOR SELECT TO anon USING (true);

CREATE TABLE IF NOT EXISTS public.case_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lawyer_id UUID REFERENCES public.users(id),
  court_name TEXT,
  judge_name TEXT,
  case_type TEXT,
  relief_sought TEXT,
  outcome TEXT CHECK (outcome IN ('won', 'lost', 'settled', 'dismissed', 'appealed')),
  duration_days INTEGER,
  injunction_granted BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.case_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lawyers can read own outcomes" ON public.case_outcomes;
CREATE POLICY "Lawyers can read own outcomes"
  ON public.case_outcomes FOR SELECT TO authenticated USING (auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Lawyers can insert outcomes" ON public.case_outcomes;
CREATE POLICY "Lawyers can insert outcomes"
  ON public.case_outcomes FOR INSERT TO authenticated WITH CHECK (auth.uid() = lawyer_id);

INSERT INTO public.judicial_intelligence
  (judge_name, court_name, bench, domain, total_cases_analyzed, injunction_grant_rate, avg_disposal_days, dismissal_rate, settlement_rate, appeal_overturn_rate, notable_precedents, specialization_score, data_period)
VALUES
  ('Justice Prathiba M. Singh', 'Delhi High Court', 'Single Bench', 'IP', 412, 0.73, 18, 0.12, 0.08, 0.09, ARRAY['Interdigital v. Xiaomi (2023)', 'Monsanto v. Nuziveedu (2019)'], 94, '2019-2024'),
  ('Justice Amit Bansal', 'Delhi High Court', 'Single Bench', 'IP', 287, 0.68, 22, 0.15, 0.10, 0.11, ARRAY['Nokia v. Oppo (2023)', 'Ericsson v. Intex (2022)'], 88, '2020-2024'),
  ('Justice Vibhu Bakhru', 'Delhi High Court', 'Single Bench', 'Commercial', 389, 0.61, 32, 0.18, 0.22, 0.10, ARRAY['Amazon v. Future Retail (2021)', 'Vodafone v. UOI (2020)'], 91, '2019-2024'),
  ('Justice G.S. Patel', 'Bombay High Court', 'Single Bench', 'IP', 356, 0.70, 21, 0.14, 0.09, 0.08, ARRAY['Bajaj v. TVS (2020)', 'Red Bull v. Pepsico (2019)'], 92, '2019-2024'),
  ('Justice Revati Mohite Dere', 'Bombay High Court', 'Single Bench', 'Criminal', 467, 0.38, 52, 0.31, 0.04, 0.16, ARRAY['State v. Varavara Rao (2021)', 'Arnab Goswami Bail (2020)'], 79, '2019-2024'),
  ('Justice N. Sathish Kumar', 'Madras High Court', 'Single Bench', 'IP', 278, 0.65, 24, 0.16, 0.11, 0.10, ARRAY['Cipla v. Roche (2022)', 'TVS v. Suzuki (2020)'], 87, '2020-2024'),
  ('Justice M. Nagaprasanna', 'Karnataka High Court', 'Single Bench', 'Constitutional', 312, 0.44, 28, 0.25, 0.03, 0.15, ARRAY['Hijab Ban Challenge (2022)', 'IT Rules Challenge (2023)'], 89, '2020-2024'),
  ('Justice Devan Ramachandran', 'Kerala High Court', 'Single Bench', 'Constitutional', 234, 0.47, 25, 0.23, 0.04, 0.13, ARRAY['Sabarimala Review (2020)', 'Internet Access as Right (2019)'], 90, '2019-2024'),
  ('Justice Biren Vaishnav', 'Gujarat High Court', 'Single Bench', 'Commercial', 276, 0.59, 34, 0.19, 0.21, 0.10, ARRAY['Adani Port Dispute (2022)', 'Reliance-ONGC Arbitration (2021)'], 80, '2019-2024'),
  ('Justice Sabyasachi Bhattacharyya', 'Calcutta High Court', 'Single Bench', 'Criminal', 345, 0.36, 62, 0.34, 0.04, 0.19, ARRAY['Narada Sting Case (2021)', 'Post-Poll Violence Cases (2021)'], 72, '2019-2024')
ON CONFLICT (judge_name, court_name, domain) DO NOTHING;

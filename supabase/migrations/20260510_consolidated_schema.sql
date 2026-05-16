-- AegisVault — Complete Supabase Schema
-- Run this in Supabase SQL Editor

-- 1) USERS
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'lawyer')),
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read all users" ON public.users;
CREATE POLICY "Users can read all users" ON public.users FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Allow service inserts" ON public.users;

-- 2) LAWYERS
CREATE TABLE IF NOT EXISTS public.lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  specialization TEXT NOT NULL,
  bio TEXT,
  location TEXT,
  rating NUMERIC DEFAULT 4.5,
  verified BOOLEAN DEFAULT false,
  experience TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lawyers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read lawyers" ON public.lawyers;
CREATE POLICY "Anyone can read lawyers" ON public.lawyers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anon can read lawyers" ON public.lawyers;
CREATE POLICY "Anon can read lawyers" ON public.lawyers FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Lawyers can insert own profile" ON public.lawyers;
CREATE POLICY "Lawyers can insert own profile" ON public.lawyers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Lawyers can update own profile" ON public.lawyers;
CREATE POLICY "Lawyers can update own profile" ON public.lawyers FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 3) REQUESTS
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lawyer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed')),
  case_description TEXT DEFAULT '',
  case_type TEXT,
  urgency_score INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parties can read requests" ON public.requests;
CREATE POLICY "Parties can read requests" ON public.requests FOR SELECT TO authenticated USING (auth.uid() = client_id OR auth.uid() = lawyer_id OR (lawyer_id IS NULL AND auth.uid() IN (SELECT user_id FROM public.lawyers)));

DROP POLICY IF EXISTS "Clients can create requests" ON public.requests;
CREATE POLICY "Clients can create requests" ON public.requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = client_id);

DROP POLICY IF EXISTS "Lawyers can update requests" ON public.requests;
DROP POLICY IF EXISTS "Parties can update requests" ON public.requests;
CREATE POLICY "Lawyers can update requests" ON public.requests FOR UPDATE TO authenticated USING (
  auth.uid() = lawyer_id 
  OR (lawyer_id IS NULL AND EXISTS (SELECT 1 FROM public.lawyers WHERE user_id = auth.uid()))
)
WITH CHECK (
  auth.uid() = lawyer_id
  OR (lawyer_id = auth.uid() AND status = 'accepted')
);

-- 4) MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content_encrypted TEXT NOT NULL,
  iv TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Participants can read messages" ON public.messages;
CREATE POLICY "Participants can read messages" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND (r.client_id = auth.uid() OR r.lawyer_id = auth.uid())));

DROP POLICY IF EXISTS "Participants can send messages" ON public.messages;
CREATE POLICY "Participants can send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id 
    AND EXISTS (
      SELECT 1 FROM public.requests r 
      WHERE r.id = request_id 
      AND ((r.client_id = sender_id AND r.lawyer_id = receiver_id) OR (r.lawyer_id = sender_id AND r.client_id = receiver_id))
    )
  );

DROP POLICY IF EXISTS "Receiver can update read status" ON public.messages;
CREATE POLICY "Receiver can update read status" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = receiver_id);

-- 5) NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  content TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users create notifications" ON public.notifications;
CREATE POLICY "Users create notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 6) CASE ANALYSIS
CREATE TABLE IF NOT EXISTS public.case_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  causal_graph JSONB,
  missing_elements JSONB,
  confidence_score FLOAT DEFAULT 0,
  recommendations TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.case_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Parties can read analysis" ON public.case_analysis;
CREATE POLICY "Parties can read analysis" ON public.case_analysis FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND (r.client_id = auth.uid() OR r.lawyer_id = auth.uid())));

DROP POLICY IF EXISTS "Insert analysis" ON public.case_analysis;
CREATE POLICY "Insert analysis" ON public.case_analysis FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.requests r WHERE r.id = request_id AND (r.client_id = auth.uid() OR r.lawyer_id = auth.uid())));

-- 7) BNS QUERIES
CREATE TABLE IF NOT EXISTS public.bns_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ipc_section TEXT NOT NULL,
  bns_section TEXT,
  strategy_shift TEXT,
  semantic_drift_score FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bns_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own bns" ON public.bns_queries;
CREATE POLICY "Users read own bns" ON public.bns_queries FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users create bns" ON public.bns_queries;
CREATE POLICY "Users create bns" ON public.bns_queries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 8) COURT SCORES
CREATE TABLE IF NOT EXISTS public.court_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  court_name TEXT NOT NULL,
  state TEXT NOT NULL,
  velocity_score FLOAT DEFAULT 0,
  injunction_rate FLOAT DEFAULT 0,
  pendency_days INTEGER DEFAULT 0,
  domain TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.court_scores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone reads courts" ON public.court_scores;
CREATE POLICY "Anyone reads courts" ON public.court_scores FOR SELECT TO authenticated USING (true);

-- ENABLE REALTIME
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;

-- SEED COURT SCORES
INSERT INTO public.court_scores (court_name, state, velocity_score, injunction_rate, pendency_days, domain) VALUES
  ('Delhi High Court','Delhi',0.82,0.71,340,'Constitutional'),
  ('Bombay High Court','Maharashtra',0.78,0.68,410,'Commercial'),
  ('Madras High Court','Tamil Nadu',0.65,0.55,520,'IP'),
  ('Karnataka High Court','Karnataka',0.75,0.62,380,'Technology'),
  ('Calcutta High Court','West Bengal',0.58,0.45,650,'Civil'),
  ('Allahabad High Court','Uttar Pradesh',0.42,0.38,890,'Criminal'),
  ('Gujarat High Court','Gujarat',0.71,0.60,420,'Commercial'),
  ('Rajasthan High Court','Rajasthan',0.55,0.42,580,'Civil'),
  ('Punjab & Haryana HC','Punjab',0.63,0.52,490,'Criminal'),
  ('Kerala High Court','Kerala',0.72,0.64,370,'Constitutional')
ON CONFLICT DO NOTHING;

-- SEED SAMPLE LAWYERS (standalone, no auth account needed)
INSERT INTO public.users (id, email, role, full_name) VALUES
  ('a1000000-0000-0000-0000-000000000001','adv.naina.iyer@example.com','lawyer','Adv. Naina Iyer'),
  ('a1000000-0000-0000-0000-000000000002','adv.arjun.mehta@example.com','lawyer','Adv. Arjun Mehta'),
  ('a1000000-0000-0000-0000-000000000003','adv.sana.qureshi@example.com','lawyer','Adv. Sana Qureshi'),
  ('a1000000-0000-0000-0000-000000000004','adv.rohan.sen@example.com','lawyer','Adv. Rohan Sen'),
  ('a1000000-0000-0000-0000-000000000005','adv.meera.nair@example.com','lawyer','Adv. Meera Nair')
ON CONFLICT (email) DO NOTHING;

INSERT INTO public.lawyers (user_id, specialization, rating, experience, phone, bio, location, verified) VALUES
  ('a1000000-0000-0000-0000-000000000001','Commercial Litigation',4.8,'15 years','+91-98765-01001','Commercial disputes and interim relief strategy','Delhi',true),
  ('a1000000-0000-0000-0000-000000000002','Criminal Litigation',4.9,'12 years','+91-98765-01002','Bail, trial strategy, and criminal procedure','Mumbai',true),
  ('a1000000-0000-0000-0000-000000000003','Family Law',4.7,'10 years','+91-98765-01003','Matrimonial disputes and negotiated settlements','Bengaluru',true),
  ('a1000000-0000-0000-0000-000000000004','Intellectual Property',4.6,'18 years','+91-98765-01004','Trade marks, copyright, and technology disputes','Chennai',true),
  ('a1000000-0000-0000-0000-000000000005','Real Estate Litigation',4.8,'14 years','+91-98765-01005','Property title, development, and tenancy disputes','Kochi',true)
ON CONFLICT DO NOTHING;

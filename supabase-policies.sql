-- AegisVault Supabase security hardening
-- Run this in Supabase SQL editor.

-- 1) Keep bucket private (do this in Storage UI as well).
-- Bucket name assumed: evidence

-- 2) Optional relational metadata table with strict RLS
create table if not exists public.evidence_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  case_id text not null,
  file_path text not null,
  metadata_path text,
  signed_url text,
  gps text,
  sha256_hash text not null,
  created_at timestamptz not null default now(),
  is_locked boolean not null default false
);

alter table public.evidence_metadata enable row level security;

drop policy if exists "Users can read own metadata" on public.evidence_metadata;
create policy "Users can read own metadata"
  on public.evidence_metadata
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own metadata" on public.evidence_metadata;
create policy "Users can insert own metadata"
  on public.evidence_metadata
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Deny update/delete by omission for legal-grade immutability.

-- 3) Storage object policies for private bucket and user path isolation
-- Path format enforced: user_id/case_id/file/... and user_id/case_id/metadata/...

drop policy if exists "Users can read own storage objects" on storage.objects;
create policy "Users can read own storage objects"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can upload own storage objects" on storage.objects;
create policy "Users can upload own storage objects"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'evidence'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[3] in ('file', 'metadata')
  );

-- Intentionally do not create UPDATE policy to prevent overwrite.
-- Intentionally do not create DELETE policy to preserve evidence immutability.

-- Run this in Supabase SQL Editor to create the blog comments table
-- Table: blog_comments

create table if not exists blog_comments (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null,           -- blog post slug
  name        text not null,           -- commenter display name
  message     text not null,           -- comment body
  approved    boolean not null default false,  -- admin approves before showing
  created_at  timestamptz not null default now()
);

-- Index for fast slug lookups
create index if not exists blog_comments_slug_idx on blog_comments (slug, approved, created_at);

-- Row-level security: anyone can read approved comments, no one can write via client
alter table blog_comments enable row level security;

-- Public read: only approved comments
create policy "Public read approved comments"
  on blog_comments for select
  using (approved = true);

-- No client-side inserts (all inserts go through the service-role API route)
-- Admins can manage rows via Supabase Dashboard or service-role key

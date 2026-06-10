-- PostgreSQL Database Schema for JEE OS
-- Optimized for scale and performance on Supabase

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE
create table if not exists public.users (
    id uuid references auth.users on delete cascade primary key,
    name text not null,
    class text not null check (class in ('11', '12', 'dropper')),
    target_year integer not null,
    coaching text,
    school text,
    study_hours_per_day numeric(3,1) not null default 6.0,
    preferred_study_time text check (preferred_study_time in ('morning', 'afternoon', 'evening', 'night')),
    study_style text check (study_style in ('visual', 'auditory', 'reading', 'kinesthetic')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS for users
alter table public.users enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read and update their own profile' AND tablename = 'users') THEN
    create policy "Users can read and update their own profile" on public.users
      for all using (auth.uid() = id);
  END IF;
END $$;

-- 2. TOPICS TABLE
-- Reference data — all authenticated and anonymous users can read.
-- Seeding via upsert is allowed for any authenticated or anonymous user.
create table if not exists public.topics (
    id text primary key, -- unique alphanumeric ID e.g. 'phy-mech-units'
    name text not null,
    subject text not null check (subject in ('physics', 'chemistry', 'mathematics')),
    chapter_id text not null,
    chapter_name text not null
);

alter table public.topics enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read topics' AND tablename = 'topics') THEN
    create policy "Anyone can read topics" on public.topics
      for select using (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can upsert topics' AND tablename = 'topics') THEN
    create policy "Anyone can upsert topics" on public.topics
      for all using (true) with check (true);
  END IF;
END $$;

-- Pre-seed topics from syllabus data is done on initialize.

-- 3. USER TOPIC STATUS TABLE (Tracks user status, confidence, accuracy per topic)
create table if not exists public.user_topic_status (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    topic_id text references public.topics(id) on delete cascade not null,
    status text not null check (status in ('not_started', 'learning', 'completed', 'revised', 'mastered')) default 'not_started',
    confidence integer not null check (confidence between 0 and 5) default 0,
    accuracy numeric(5,2) not null check (accuracy between 0.00 and 100.00) default 0.00,
    last_studied_at timestamp with time zone,
    completed_at timestamp with time zone,
    last_revision_at timestamp with time zone,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, topic_id)
);

create index if not exists user_topic_status_uid_idx on public.user_topic_status(user_id);
alter table public.user_topic_status enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own topic status' AND tablename = 'user_topic_status') THEN
    create policy "Users can manage their own topic status" on public.user_topic_status
      for all using (auth.uid() = user_id);
  END IF;
END $$;

-- 4. STUDY LOGS TABLE
create table if not exists public.study_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    date timestamp with time zone default timezone('utc'::text, now()) not null,
    description text not null,
    topic_id text references public.topics(id) on delete set null,
    chapter_id text,
    subject text check (subject in ('physics', 'chemistry', 'mathematics')),
    duration integer not null, -- minutes
    log_type text not null check (log_type in ('study', 'revision', 'practice', 'test', 'school')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists study_logs_uid_idx on public.study_logs(user_id);
alter table public.study_logs enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own study logs' AND tablename = 'study_logs') THEN
    create policy "Users can manage their own study logs" on public.study_logs
      for all using (auth.uid() = user_id);
  END IF;
END $$;

-- 5. REVISION TASKS TABLE (Spaced Repetition items)
create table if not exists public.revision_tasks (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    topic_id text references public.topics(id) on delete cascade not null,
    chapter_id text,
    subject text check (subject in ('physics', 'chemistry', 'mathematics')),
    topic_name text,
    chapter_name text,
    revision_number integer not null check (revision_number >= 1),
    due_date date not null,
    completed_at timestamp with time zone,
    ease_factor numeric(4,2) not null default 2.50,
    interval_days integer not null default 1,
    repetitions integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists revision_tasks_uid_due_idx on public.revision_tasks(user_id, due_date);
alter table public.revision_tasks enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own revision tasks' AND tablename = 'revision_tasks') THEN
    create policy "Users can manage their own revision tasks" on public.revision_tasks
      for all using (auth.uid() = user_id);
  END IF;
END $$;

-- 6. TEST ATTEMPTS TABLE
create table if not exists public.test_attempts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    date timestamp with time zone default timezone('utc'::text, now()) not null,
    test_type text not null check (test_type in ('topic', 'chapter', 'mixed', 'daily', 'mock_main', 'mock_advanced')),
    title text not null,
    time_spent integer not null, -- seconds
    score integer not null,
    max_score integer not null,
    questions_json jsonb not null, -- Store questions asked
    answers_json jsonb not null,   -- Store user answers
    subject_breakdown jsonb not null, -- Store correctness breakdown by subject
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists test_attempts_uid_idx on public.test_attempts(user_id);
alter table public.test_attempts enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own test attempts' AND tablename = 'test_attempts') THEN
    create policy "Users can manage their own test attempts" on public.test_attempts
      for all using (auth.uid() = user_id);
  END IF;
END $$;

-- 7. MISTAKE EVENTS TABLE (Tracks individual incorrect answers)
create table if not exists public.mistake_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    test_attempt_id uuid references public.test_attempts(id) on delete cascade,
    topic_id text references public.topics(id) on delete set null,
    question_text text not null,
    options jsonb not null default '[]'::jsonb,
    correct_answer integer not null default 0,
    user_answer integer not null default 0,
    explanation text not null default '',
    status text not null check (status in ('pending', 'resolved')) default 'pending',
    next_replay_date timestamp with time zone default timezone('utc'::text, now()) not null,
    error_type text not null check (error_type in ('concept_gap', 'formula_forgotten', 'calculation_mistake', 'time_pressure', 'misread_question', 'guessing_error')),
    mistake_path text not null, -- e.g. 'Physics -> Mechanics -> Kinematics -> Relative Velocity'
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists mistake_events_uid_path_idx on public.mistake_events(user_id, mistake_path);
alter table public.mistake_events enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own mistake events' AND tablename = 'mistake_events') THEN
    create policy "Users can manage their own mistake events" on public.mistake_events
      for all using (auth.uid() = user_id);
  END IF;
END $$;

-- 8. TOPIC EVENTS TABLE (Change logs for telemetry/timeline graphs)
create table if not exists public.topic_events (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    topic_id text references public.topics(id) on delete cascade not null,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null,
    field text not null check (field in ('status', 'confidence', 'accuracy')),
    old_value text not null,
    new_value text not null,
    source text not null check (source in ('study_log', 'test', 'manual', 'ai_tutor')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists topic_events_uid_topic_idx on public.topic_events(user_id, topic_id);
alter table public.topic_events enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can read and create their own topic events' AND tablename = 'topic_events') THEN
    create policy "Users can read and create their own topic events" on public.topic_events
      for all using (auth.uid() = user_id);
  END IF;
END $$;

-- 9. READINESS SNAPSHOTS TABLE (For charting progress over time)
create table if not exists public.readiness_snapshots (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    date date default current_date not null,
    physics_readiness integer not null,
    chemistry_readiness integer not null,
    mathematics_readiness integer not null,
    overall_readiness integer not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, date)
);

create index if not exists readiness_snapshots_uid_date_idx on public.readiness_snapshots(user_id, date);
alter table public.readiness_snapshots enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own snapshots' AND tablename = 'readiness_snapshots') THEN
    create policy "Users can manage their own snapshots" on public.readiness_snapshots
      for all using (auth.uid() = user_id);
  END IF;
END $$;

-- 10. DOCUMENTS & DOCUMENT CHUNKS (For RAG study resources)
create table if not exists public.documents (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade, -- null if global/official documents
    title text not null,
    subject text check (subject in ('physics', 'chemistry', 'mathematics')),
    file_path text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.document_chunks (
    id uuid default gen_random_uuid() primary key,
    document_id uuid references public.documents(id) on delete cascade not null,
    content text not null,
    -- For pgvector support (embeddings) on Supabase
    -- embedding vector(1536), 
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 11. AI CONVERSATIONS TABLE
create table if not exists public.ai_conversations (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    agent_type text not null check (agent_type in ('tutor', 'coach')),
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    messages jsonb not null default '[]'::jsonb
);

create index if not exists ai_conversations_uid_idx on public.ai_conversations(user_id);
alter table public.ai_conversations enable row level security;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own AI conversations' AND tablename = 'ai_conversations') THEN
    create policy "Users can manage their own AI conversations" on public.ai_conversations
      for all using (auth.uid() = user_id);
  END IF;
END $$;

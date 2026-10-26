-- GapFinder AI — initial schema
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent where practical.

create extension if not exists vector with schema extensions;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type doc_status as enum ('pending', 'processing', 'ready', 'failed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type quiz_status as enum ('ready', 'submitted');
exception when duplicate_object then null; end $$;
do $$ begin
  create type mastery_state as enum ('weak', 'developing', 'strong', 'not_assessed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type task_activity as enum ('read', 'practice', 'assess', 'tutor', 'review');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables. Every row carries user_id (defaulting to the caller) so a single,
-- uniform RLS rule `user_id = auth.uid()` isolates each student's data.
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  subject text not null default '' check (char_length(subject) <= 120),
  exam_date date,
  hours_per_day numeric(4,1) not null default 2 check (hours_per_day > 0 and hours_per_day <= 16),
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists workspaces_user_idx on workspaces(user_id);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  storage_path text not null,
  mime text not null,
  size_bytes int not null default 0,
  status doc_status not null default 'pending',
  error text,
  page_count int,
  chunk_count int not null default 0,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documents_ws_idx on documents(workspace_id);

create table if not exists document_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  document_id uuid not null references documents on delete cascade,
  idx int not null,
  content text not null,
  page int,
  heading text,
  embedding extensions.vector(768),
  fts tsvector generated always as (to_tsvector('english', coalesce(heading, '') || ' ' || content)) stored,
  created_at timestamptz not null default now(),
  unique (document_id, idx)
);
create index if not exists chunks_ws_idx on document_chunks(workspace_id);
create index if not exists chunks_doc_idx on document_chunks(document_id);
create index if not exists chunks_fts_idx on document_chunks using gin(fts);
create index if not exists chunks_embedding_idx on document_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

create table if not exists topics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  parent_id uuid references topics on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  summary text not null default '',
  importance smallint not null default 2 check (importance between 1 and 3),
  created_at timestamptz not null default now(),
  unique (workspace_id, name)
);
create index if not exists topics_ws_idx on topics(workspace_id);

create table if not exists topic_chunks (
  topic_id uuid not null references topics on delete cascade,
  chunk_id uuid not null references document_chunks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (topic_id, chunk_id)
);
create index if not exists topic_chunks_chunk_idx on topic_chunks(chunk_id);

create table if not exists quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  kind text not null default 'diagnostic' check (kind in ('diagnostic', 'practice')),
  status quiz_status not null default 'ready',
  question_count int not null default 0,
  rejected_count int not null default 0,
  correct_count int,
  score numeric(5,4),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists quizzes_ws_idx on quizzes(workspace_id, created_at desc);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  quiz_id uuid not null references quizzes on delete cascade,
  topic_id uuid references topics on delete set null,
  position int not null,
  stem text not null,
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  explanation text not null,
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  source_chunk_ids uuid[] not null default '{}',
  evidence_quote text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists questions_quiz_idx on quiz_questions(quiz_id, position);
create index if not exists questions_topic_idx on quiz_questions(topic_id);

create table if not exists quiz_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  quiz_id uuid not null references quizzes on delete cascade,
  question_id uuid not null unique references quiz_questions on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists responses_quiz_idx on quiz_responses(quiz_id);

-- The database, not the client, decides correctness.
create or replace function set_response_correctness() returns trigger
language plpgsql as $$
begin
  select (new.selected_index = q.correct_index) into new.is_correct
  from quiz_questions q where q.id = new.question_id and q.quiz_id = new.quiz_id;
  if new.is_correct is null then
    raise exception 'question does not belong to quiz';
  end if;
  return new;
end $$;
drop trigger if exists trg_response_correctness on quiz_responses;
create trigger trg_response_correctness before insert on quiz_responses
  for each row execute function set_response_correctness();

create table if not exists topic_mastery (
  topic_id uuid primary key references topics on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  score numeric(5,4) not null default 0,
  n_questions int not null default 0,
  n_correct int not null default 0,
  state mastery_state not null default 'not_assessed',
  provisional boolean not null default true,
  reasons jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
create index if not exists mastery_ws_idx on topic_mastery(workspace_id);

create table if not exists mastery_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  quiz_id uuid references quizzes on delete set null,
  score numeric(5,4) not null,
  state mastery_state not null,
  n_questions int not null,
  created_at timestamptz not null default now()
);
create index if not exists mastery_history_ws_idx on mastery_history(workspace_id, created_at);

create table if not exists revision_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  version int not null,
  budget_minutes int not null,
  change_summary jsonb not null default '[]',
  unscheduled jsonb not null default '[]',
  snapshot jsonb not null default '[]', -- topic states the plan was built from (for diffs)
  created_at timestamptz not null default now(),
  unique (workspace_id, version)
);

create table if not exists revision_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  plan_id uuid not null references revision_plans on delete cascade,
  topic_id uuid references topics on delete set null,
  topic_name text not null,
  activity task_activity not null,
  priority numeric(6,3) not null,
  minutes int not null check (minutes > 0),
  reason text not null,
  source_chunk_ids uuid[] not null default '{}',
  due_date date not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists tasks_plan_idx on revision_tasks(plan_id, due_date);
create index if not exists tasks_ws_idx on revision_tasks(workspace_id);

create table if not exists study_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  kind text not null,
  label text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_ws_idx on study_activity(workspace_id, created_at desc);

create table if not exists tutor_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  workspace_id uuid not null references workspaces on delete cascade,
  topic_id uuid references topics on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  citations jsonb not null default '[]',
  insufficient_evidence boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists tutor_ws_idx on tutor_messages(workspace_id, created_at);

create table if not exists ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null,
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_idx on ai_usage(user_id, endpoint, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
create or replace function owns_workspace(wid uuid) returns boolean
language sql stable as $$
  select exists (select 1 from workspaces w where w.id = wid and w.user_id = auth.uid())
$$;

-- Create a profile row for each new auth user.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

alter table profiles enable row level security;
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());

alter table workspaces enable row level security;
drop policy if exists own_rows on workspaces;
create policy own_rows on workspaces for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Tables scoped by workspace: own rows, and writes must target an owned workspace.
do $$
declare t text;
begin
  foreach t in array array[
    'documents', 'document_chunks', 'topics', 'quizzes', 'topic_mastery',
    'mastery_history', 'revision_plans', 'revision_tasks', 'study_activity', 'tutor_messages'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid()) '
      'with check (user_id = auth.uid() and owns_workspace(workspace_id))', t);
  end loop;
end $$;

-- Tables without workspace_id.
do $$
declare t text;
begin
  foreach t in array array['topic_chunks', 'quiz_questions', 'ai_usage'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format(
      'create policy own_rows on %I for all using (user_id = auth.uid()) '
      'with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Responses are insert/select only: no edits after submission.
alter table quiz_responses enable row level security;
drop policy if exists own_select on quiz_responses;
drop policy if exists own_insert on quiz_responses;
create policy own_select on quiz_responses for select using (user_id = auth.uid());
create policy own_insert on quiz_responses for insert with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Hybrid retrieval: vector cosine + full-text, fused with Reciprocal Rank Fusion.
-- SECURITY INVOKER (default) so RLS limits results to the caller's own chunks.
-- p_query is a pre-sanitised OR-tsquery string built by the app ("a | b | c").
-- ---------------------------------------------------------------------------
create or replace function match_chunks(
  p_workspace uuid,
  p_embedding extensions.vector(768),
  p_query text,
  p_k int default 6
) returns table (
  id uuid, document_id uuid, document_title text, content text,
  page int, heading text, similarity float, score float
)
language sql stable
set search_path = public, extensions
as $$
  with sem as (
    select c.id, row_number() over (order by c.embedding <=> p_embedding) as r
    from document_chunks c
    where c.workspace_id = p_workspace and c.embedding is not null
    order by c.embedding <=> p_embedding
    limit 20
  ),
  kw as (
    select c.id, row_number() over (order by ts_rank(c.fts, q) desc) as r
    from document_chunks c, to_tsquery('english', coalesce(nullif(p_query, ''), 'zzzznomatch')) q
    where c.workspace_id = p_workspace and c.fts @@ q
    order by ts_rank(c.fts, q) desc
    limit 20
  ),
  fused as (
    select coalesce(sem.id, kw.id) as id,
           coalesce(1.0 / (60 + sem.r), 0) + coalesce(1.0 / (60 + kw.r), 0) as score
    from sem full outer join kw on sem.id = kw.id
  )
  select c.id, c.document_id, d.title, c.content, c.page, c.heading,
         (1 - (c.embedding <=> p_embedding))::float as similarity, f.score::float
  from fused f
  join document_chunks c on c.id = f.id
  join documents d on d.id = c.document_id
  order by f.score desc
  limit least(greatest(p_k, 1), 12);
$$;

-- ---------------------------------------------------------------------------
-- Storage: private bucket, files under "<user_id>/..."
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760,
        array['application/pdf', 'text/plain', 'text/markdown'])
on conflict (id) do nothing;

drop policy if exists "documents_own_select" on storage.objects;
drop policy if exists "documents_own_insert" on storage.objects;
drop policy if exists "documents_own_delete" on storage.objects;
create policy "documents_own_select" on storage.objects for select
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_own_insert" on storage.objects for insert
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documents_own_delete" on storage.objects for delete
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

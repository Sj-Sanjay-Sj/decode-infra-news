-- Run once in the Supabase SQL editor. Safe to reapply to this schema.
begin;
create table if not exists public.real_estate_news (
    id uuid primary key default gen_random_uuid(),
    title text not null check (length(trim(title)) between 1 and 1000),
    source text not null,
    url text not null unique check (url ~ '^https?://'),
    published_at timestamptz not null,
    city varchar(120) not null,
    category varchar(40) not null check (category in
        ('Residential', 'Commercial', 'Policy/RERA', 'Infrastructure', 'Market Insights')),
    developer varchar(200),
    micro_market varchar(200),
    investment_figure varchar(250),
    description text not null default '',
    bullet_summary text[] not null check (
        array_ndims(bullet_summary) = 1 and array_lower(bullet_summary, 1) = 1
        and cardinality(bullet_summary) = 2 and array_position(bullet_summary, null) is null
        and length(trim(bullet_summary[1])) between 1 and 350
        and length(trim(bullet_summary[2])) between 1 and 350
    ),
    ai_model text not null default 'gemini-2.5-flash',
    created_at timestamptz not null default now()
);
create index if not exists news_latest_idx on public.real_estate_news (published_at desc, id desc);
create index if not exists news_created_idx on public.real_estate_news (created_at);
alter table public.real_estate_news enable row level security;
revoke all on public.real_estate_news from anon, authenticated;
grant select on public.real_estate_news to anon, authenticated;
grant select, insert, update, delete on public.real_estate_news to service_role;
drop policy if exists news_public_read on public.real_estate_news;
create policy news_public_read on public.real_estate_news for select to anon, authenticated using (true);
-- No client write policy. SUPABASE_KEY in Actions must be a server service-role/secret key.

do $$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
    if not exists (select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'real_estate_news') then
        alter publication supabase_realtime add table public.real_estate_news;
    end if;
end $$;

-- POST bodies avoid URI limits from long Google News links in GET filters.
create or replace function public.existing_news_urls(p_urls text[])
returns table(url text) language sql stable security invoker set search_path = '' as $$
    select n.url from public.real_estate_news n where n.url = any(p_urls);
$$;
revoke all on function public.existing_news_urls(text[]) from public, anon, authenticated;
grant execute on function public.existing_news_urls(text[]) to service_role;

-- Shared daily request budget, inaccessible to browser clients.
create table if not exists public.news_ai_usage (
    day date primary key,
    calls integer not null check (calls > 0)
);
alter table public.news_ai_usage enable row level security;
revoke all on public.news_ai_usage from public, anon, authenticated;
grant select, insert, update, delete on public.news_ai_usage to service_role;
create or replace function public.claim_news_ai_call(p_limit integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare claimed integer;
begin
    if p_limit < 1 or p_limit > 100 then raise exception 'Invalid daily budget'; end if;
    delete from public.news_ai_usage where day < (now() at time zone 'UTC')::date - 14;
    insert into public.news_ai_usage (day, calls)
        values ((now() at time zone 'UTC')::date, 1)
        on conflict (day) do update set calls = public.news_ai_usage.calls + 1
        where public.news_ai_usage.calls < p_limit
        returning calls into claimed;
    return claimed is not null;
end $$;
revoke all on function public.claim_news_ai_call(integer) from public, anon, authenticated;
grant execute on function public.claim_news_ai_call(integer) to service_role;
commit;

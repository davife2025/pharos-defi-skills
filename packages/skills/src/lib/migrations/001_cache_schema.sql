-- ─────────────────────────────────────────────────────────────────────────────
-- Pharos DeFi Skills — Supabase Cache Schema
-- Run this in your Supabase SQL editor or via supabase db push
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── portfolio_snapshot_cache ─────────────────────────────────────────────────
-- Caches portfolio snapshots per wallet per block.
-- A new block = a new cache entry. Same block = cache hit.

create table if not exists portfolio_snapshot_cache (
  id             uuid primary key default uuid_generate_v4(),
  wallet_address text        not null,
  network        text        not null default 'testnet',
  block_number   bigint      not null,
  block_timestamp bigint     not null,
  chain_id       int         not null,
  native_balance jsonb       not null,
  token_balances jsonb       not null default '[]',
  fetched_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

-- Fast lookup: wallet + network + block
create unique index if not exists portfolio_snapshot_cache_wallet_block
  on portfolio_snapshot_cache (wallet_address, network, block_number);

-- Cleanup index — for TTL-based purging
create index if not exists portfolio_snapshot_cache_created_at
  on portfolio_snapshot_cache (created_at);

-- ─── token_price_cache ────────────────────────────────────────────────────────
-- Caches token prices with a TTL.
-- Price feeds can tolerate short staleness (e.g. 30 seconds on fast chains).

create table if not exists token_price_cache (
  id                  uuid primary key default uuid_generate_v4(),
  token_address       text        not null,
  quote_token_address text        not null,
  network             text        not null default 'testnet',
  chain_id            int         not null,
  price               text        not null,
  price_raw           text        not null,
  block_number        bigint      not null,
  pool_address        text        not null,
  reserve0            text        not null,
  reserve1            text        not null,
  fetched_at          timestamptz not null default now(),
  expires_at          timestamptz not null,
  created_at          timestamptz not null default now()
);

-- Fast lookup: token pair + network
create index if not exists token_price_cache_lookup
  on token_price_cache (token_address, quote_token_address, network, expires_at desc);

-- Cleanup index
create index if not exists token_price_cache_expires_at
  on token_price_cache (expires_at);

-- ─── skill_call_log ───────────────────────────────────────────────────────────
-- Audit log of every skill call — useful for analytics and debugging.

create table if not exists skill_call_log (
  id           uuid primary key default uuid_generate_v4(),
  skill        text        not null,
  request_id   text,
  network      text,
  success      boolean     not null,
  duration_ms  int         not null,
  error_code   text,
  error_msg    text,
  input_hash   text,        -- SHA-256 of serialised input params (no PII)
  created_at   timestamptz not null default now()
);

create index if not exists skill_call_log_skill_created
  on skill_call_log (skill, created_at desc);

create index if not exists skill_call_log_success
  on skill_call_log (success, created_at desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Enable RLS on all tables. Service key bypasses these.

alter table portfolio_snapshot_cache enable row level security;
alter table token_price_cache        enable row level security;
alter table skill_call_log           enable row level security;

-- Service role has full access (used by the skills server)
create policy "service_full_access_portfolio" on portfolio_snapshot_cache
  for all using (auth.role() = 'service_role');

create policy "service_full_access_price" on token_price_cache
  for all using (auth.role() = 'service_role');

create policy "service_full_access_log" on skill_call_log
  for all using (auth.role() = 'service_role');

-- ─── Cleanup Function ─────────────────────────────────────────────────────────
-- Call this periodically (e.g. via pg_cron) to purge stale cache rows.

create or replace function purge_expired_cache()
returns void language plpgsql as $$
begin
  -- Remove price cache entries that have expired
  delete from token_price_cache where expires_at < now();

  -- Remove portfolio snapshots older than 10 minutes
  delete from portfolio_snapshot_cache
    where created_at < now() - interval '10 minutes';

  -- Remove skill call logs older than 30 days
  delete from skill_call_log
    where created_at < now() - interval '30 days';
end;
$$;

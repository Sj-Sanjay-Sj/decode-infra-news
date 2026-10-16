# Decode Infra — live real estate news

A runnable Next.js app plus Python RSS ingestion, Supabase SQL, and a 20-minute GitHub Actions workflow. News ingestion runs separately from hosting; browsers read the latest ten rows and receive Supabase Postgres Changes immediately after insertion.

## Free-tier constraints — read before deployment

This code uses no paid API features, search grounding, paid extraction services, or hosting-specific server functions. **The exact requested stack cannot guarantee a free commercial production deployment.**

- **Vercel Hobby is for personal, non-commercial use.** A commercial real estate portal needs different hosting or a paid Vercel plan. The supplied frontend is a static export, so it can be served by an existing host that supports static files; no Next.js server is necessary. Do not deploy a commercial portal on Hobby assuming its terms allow it. [Vercel terms](https://vercel.com/legal/terms).
- **Use a public GitHub repository and standard Linux runners for the supplied 20-minute schedule.** This is 72 runs/day, or 2,232 runs in a 31-day month. Private repositories can exceed their 2,000-minute allowance. Keep Actions paid usage disabled/set an enforced zero spending budget. Standard runners in public repositories are free. [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
- **Gemini 2.5 Flash currently has free input/output, but Google restricts the 2.5 models to projects that actively used them previously.** Confirm access before deploying this exact model. This implementation intentionally keeps the requested `gemini-2.5-flash`; it does not silently switch models. New projects may need an explicitly chosen supported free-tier model and corresponding configuration changes. Use a free-tier project without paid billing; a script cannot determine your billing tier from an API key. [Pricing](https://ai.google.dev/gemini-api/docs/pricing), [model availability](https://ai.google.dev/gemini-api/docs/deprecations).
- Daily request, token and minute limits vary by project. Check AI Studio and set `GEMINI_DAILY_REQUEST_LIMIT` below your actual available daily quota. The default 15/day is a conservative application budget, **not a promise about Google's allowance**. The database counter counts attempted calls and retries, resets at UTC midnight, and only covers this pipeline. Share neither its key nor quota with unrelated workloads if you need predictable capacity. A 429 stops processing with a visible failed job; the script never upgrades to paid access.
- Supabase Free has finite database, egress, connections, and Realtime quotas. Stay on the Free plan; monitor usage rather than assuming unlimited traffic. Thirty-day record retention bounds normal database growth, but cannot bound anonymous public traffic. Free projects can be restricted or paused and have no production availability guarantee. [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Realtime limits](https://supabase.com/docs/guides/realtime/limits).
- GitHub cron is best effort: jobs can be delayed or dropped, only run from the default branch, and public-repository schedules are disabled after 60 days without repository activity. Realtime means live delivery **after an insert**, not continuous publisher scraping. [Schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Files

- `ingest.py`: bounded feed fetching, BeautifulSoup text extraction, link deduplication, Gemini extraction and insertion.
- `schema.sql`: table, entity fields, indexes, public read-only RLS, Realtime publication and private AI budget function.
- `.github/workflows/ingest.yml`: scheduled and manual ingestion, minimal repository permissions, concurrency control and time limit.
- `components/LiveNewsTicker.tsx` and its CSS module: latest ten stories, city/category tags, two bullets, live inserts, reconnect reconciliation, foreground recovery and cleanup.
- `app/`: small standalone Next.js App Router integration. For an existing portal, copy the component and CSS module and render `<LiveNewsTicker />`.
- `requirements-lock.txt`, `package-lock.json`: tested dependency versions. Keep these committed and update them deliberately for security fixes. `requirements.txt` describes compatible direct dependencies.

## 1. Create the database

Create a free Supabase project and run the entire `schema.sql` in its SQL editor. This creates a new schema; `CREATE TABLE IF NOT EXISTS` does not migrate an unrelated pre-existing table. Review migrations if the table already exists with different columns.

Obtain its project URL, public **anon/publishable** key and server **service-role/secret** key. Postgres Changes requires the table in the `supabase_realtime` publication; the SQL configures this idempotently. Public keys can SELECT; they cannot INSERT/UPDATE/DELETE or invoke the budget function. The server key is privileged: keep it in GitHub Secrets, never browser code. [Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes).

## 2. Configure ingestion

Place the contents of this directory at your repository root (including the hidden `.github` directory). Add GitHub **Repository Secrets**:

| Secret | Value |
| --- | --- |
| `GEMINI_API_KEY` | Free-tier Gemini project key with 2.5 Flash access |
| `SUPABASE_URL` | `https://YOUR_PROJECT.supabase.co` |
| `SUPABASE_KEY` | Server service-role/secret key, never the public anon key |

Optionally add repository variable `GEMINI_DAILY_REQUEST_LIMIT` (default `15`). The workflow limits each run to three articles; set the daily budget according to your available quota. Fifteen daily requests can enrich at most fifteen articles/day, fewer after retries. Increasing coverage requires an available free quota; excess candidates are deferred, not guaranteed eventual processing.

Enable Actions, commit to the default branch and run **Decode Infra news ingestion → Run workflow** once. Confirm rows appear in Supabase. Normal success is quiet; feed warnings and actual failures are retained in job logs. Dependencies are installed without verbose output. Never suppress failures with `|| true`.

For a local run (Python 3.12+):

```sh
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -r requirements-lock.txt
# Export GEMINI_API_KEY, SUPABASE_URL and SUPABASE_KEY in your shell.
python ingest.py
python -m unittest discover -s tests -v
```

Python reads process environment variables; it does not automatically load `.env` files. Do not commit real credentials. `.env.example` documents the settings.

## 3. Configure the frontend

Create `.env.local` with **only the browser settings**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY
```

```sh
npm ci
npm run dev
```

The key is intentionally public and protected by RLS. Do not copy `SUPABASE_KEY` into any `NEXT_PUBLIC_*` setting. The component renders untrusted text as React text, validates HTTP links, and opens publisher links with `noopener noreferrer`.

For production:

```sh
npm run typecheck
npm run build
```

Serve the resulting `out/` directory from a static host. Environment values are embedded at build time: rebuild when changing Supabase projects/keys. Vercel can use the Next.js preset with these two public environment variables, subject to its commercial-use terms. The GitHub ingestion job runs independently and uses no Vercel cron or paid server functions.

## Feed behavior and data quality

The configured sources are ETRealty, a national/city/topic Google News RSS search, a candidate RealtyNXT direct feed, and Google News publisher searches for RealtyNXT and Magicbricks. Direct feed URLs can change or be blocked. During verification, ETRealty and all three Google News queries returned valid RSS; `https://realtynxt.com/feed/` returned an HTTP error. It is isolated and does not prevent the other sources from running. A verified current direct Magicbricks RSS endpoint was unavailable, so publisher coverage uses Google's site search rather than an invented endpoint.

To replace feeds locally, export `NEWS_FEEDS_JSON` as a JSON object mapping source name to HTTPS feed URL. For Actions, add the same variable to the workflow environment backed by a repository variable. Validate publishers' current feeds before relying on them. Feed fetching is bounded to 2 MB, 100 entries/source, timeouts and limited retries. HTML responses are rejected; all feeds failing produces a failed job. Partial source failures produce warnings.

Only RSS titles/descriptions are supplied to Gemini, not full articles or paywalled content. Missing/invalid dates, entries older than 72 hours, and entries more than 15 minutes in the future are skipped. Missing entities are null; city is `India` for national items or `Unknown` when evidence is insufficient. The stored description preserves the plain-text excerpt for review. Summaries contain exactly two validated strings. Structured output improves format reliability but cannot guarantee factual correctness; review important items against the linked source.

Links are normalized by removing fragments and common tracking parameters while retaining article identity query parameters. Deduplication is by URL before AI processing, with a database UNIQUE constraint and conflict-ignore insert as the final guard. **Different URLs for syndicated stories are not semantic duplicates.** Google News RSS links remain Google redirect URLs; the code does not attempt unsupported decoding or fetch arbitrary publisher URLs. The same story in ETRealty and Google News can therefore appear twice. No claim of cross-publisher deduplication is made.

Candidates are processed oldest first within the 72-hour window to reduce starvation. There is no durable raw-feed backlog: failed items can be retried while they remain in RSS, but items that age out, disappear, or exceed the daily quota can be lost. This is a bounded free-tier feed, not a complete news archive. Thirty-day cleanup deletes stored articles; AI budget history older than fourteen days is also pruned.

## Live behavior and validation

The component fetches the latest ten rows ordered by publication time, merges INSERT events immediately, and refreshes a snapshot after changes or successful subscriptions. Stale query results cannot overwrite a newer realtime insert. It removes subscriptions/timers on unmount and refreshes once per minute while visible plus on tab return. Public SELECT access is intentional; keep private editorial drafts in a separate restricted table. [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

Local checks cover URL identity, invalid links, HTML cleaning, feed dates, transient HTTP failures, HTML masquerading as RSS, structured AI output, exact bullet count, exhausted application budgets and 429 behavior. The Next.js production build and TypeScript validation pass. Embedded PostgreSQL checks also passed for schema reapplication, public read-only permissions, service writes, URL uniqueness, bullet constraints, and the daily request cap. These do not substitute for a hosted Supabase Realtime test. Live feed probes were performed without Gemini or Supabase credentials. Full live AI ingestion and hosted Realtime delivery still require your project credentials and a successful smoke test:

1. Run the SQL and manual ingestion workflow.
2. Open two browser sessions and verify new inserted stories appear in both.
3. Disconnect/reconnect one session and verify it recovers the latest ten stories.
4. Confirm public-key writes and calls to `claim_news_ai_call` fail.
5. Re-run ingestion and confirm existing URLs create no new rows.

Keep dependency lockfiles current. The app uses the patched Next.js 15.5 maintenance line, satisfying Next.js 14+. [October 2026 security release](https://nextjs.org/blog/nextjs-security-update-october-14-2026).

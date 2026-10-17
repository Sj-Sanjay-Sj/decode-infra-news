# Decode Infra — Hyderabad news

A Next.js static site, Python RSS collector, Supabase database and 20-minute GitHub Actions schedule. The live site shows **Hyderabad-only news from the past 30 days**, newest first, with 50-item pagination and Realtime updates.

## Deployment

- Website: https://decode-infra-news.vercel.app/
- Repository: https://github.com/Sj-Sanjay-Sj/decode-infra-news
- Personal, non-commercial Vercel Hobby deployment; Supabase Free; public GitHub standard Linux runners; Gemini free-tier project without paid billing.
- Free tiers have quotas and can change. This configuration does not enable paid billing or guarantee complete coverage or uninterrupted availability. Vercel Hobby must not be assumed suitable for commercial use.

## Ingestion and coverage

`ingest.py` fetches ETRealty, Telangana Today’s property feed and five focused Google News RSS searches covering Hyderabad property, infrastructure, local markets, policy and blogs. Topic and location checks reject unrelated results such as cricket, job notices and Hyderabad in Pakistan. Publishers and search engines can omit, delay or block stories.

All relevant new discoveries are saved before AI enrichment. The default AI budget is 15 attempted requests per UTC day and three articles per run. Articles without AI output remain available with `ai_model=source-excerpt`; the website labels these as source headlines/excerpts. A quota error stops AI processing without discarding saved discoveries. Unknown entities remain null. Categories are automatically assigned and can need editorial correction.

Dates come from feed publication timestamps. Undated entries, entries older than 30 days and entries more than 15 minutes in the future are skipped. Collection is bounded to 100 entries per source, 2 MB per feed, timeouts and limited retries. URL conflicts cannot duplicate stored rows; Google wrappers and different publishers can still cover the same event. Old records are pruned by publication date after 30 days.

`backfill.py` searches the last 30 days in overlapping weekly date windows across six topic groups, plus current feeds. It removes identical headlines, preferring direct publisher URLs over Google wrappers. This broadens discovery beyond current RSS items but cannot guarantee every article online.

```sh
python backfill.py --output hyderabad-backfill.json
```

The output contains public metadata, source excerpts and source-health results. Import its `rows` through an authorized server connection with URL conflict protection. Do not put a database write key in the browser.

## Setup

Use Python 3.12+, install `requirements-lock.txt`, and run `schema.sql` in the Supabase SQL editor. It creates the news table, public read policy, Realtime publication, private AI request counter and server-only URL lookup function. Browser clients cannot write news or claim the AI budget.

Set these GitHub repository secrets:

- `GEMINI_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY` — server service-role/secret key, never a browser key

The workflow runs every 20 minutes; scheduled runs may be delayed. Use a public repository with standard runners to avoid the private-repository 2,000-minute limit. Keep paid usage disabled. Repository variable `GEMINI_DAILY_REQUEST_LIMIT` defaults to 15; this is an application cap, not a statement of Google's available quota. The model is explicitly `gemini-3.8-flash`, approved for this deployment when 2.5 Flash was unavailable.

For the website, install from `package-lock.json` and set `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
```

Only the publishable key belongs in `NEXT_PUBLIC_*`. `npm run build` creates `out/` for static hosting. Deploy that output to the existing Vercel project. News changes do not require redeployment; source changes do. GitHub and Vercel are not connected for automatic deployments.

```sh
python -m unittest discover -s tests -v
npm run build
```

Tests cover URL identity, dated-feed parsing, Hyderabad relevance, source-excerpt labelling, quota-safe persistence, transient feed failures, long-URL POST lookup, AI output validation and quota handling. Verify meaningful facts against original publishers before relying on summaries.

## Frontend and digest

`LiveNewsTicker.tsx` queries `city=Hyderabad` and a rolling 30-day publication cutoff. It loads 50 stories initially and offers more pages, merges relevant inserts, reconciles after changes/reconnects, and refreshes while visible to recover missed events. `CoverageDetails.tsx` explains source coverage and the separate owner digest.

The owner's Codex automation sends a **Hyderabad-only daily Gmail digest at 9:00 AM IST**, when meaningful new stories are available. It uses connected Gmail/web tools, not a public subscription form or the website's AI quota. The digest has its own publisher/date checks and duplicate detection. Automation availability depends on the connected host and account access.

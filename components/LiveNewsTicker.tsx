"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "./LiveNewsTicker.module.css";

type News = {
  id: string;
  title: string;
  source: string;
  url: string;
  published_at: string;
  city: string;
  category: string;
  bullet_summary: string[];
  ai_model: string;
};
const columns = "id,title,source,url,published_at,city,category,bullet_summary,ai_model";

// Select only the public fields. Never put a service-role key in NEXT_PUBLIC_*.
function validNews(value: unknown): value is News {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["id", "title", "source", "url", "published_at", "city", "category", "ai_model"]
    .every((key) => typeof row[key] === "string") &&
    /^https?:\/\//i.test(String(row.url)) &&
    Number.isFinite(Date.parse(String(row.published_at))) &&
    Array.isArray(row.bullet_summary) && row.bullet_summary.length === 2 &&
    row.bullet_summary.every((bullet) => typeof bullet === "string");
}

function inWindow(row: News): boolean {
  const age = Date.now() - Date.parse(row.published_at);
  return row.city === "Hyderabad" && age >= -15 * 60_000 && age <= 30 * 86_400_000;
}

function latest(rows: News[], limit: number): News[] {
  return [...new Map(rows.filter(inWindow).map((row) => [row.id, row])).values()]
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at) || b.id.localeCompare(a.id))
    .slice(0, limit);
}

export default function LiveNewsTicker() {
  const [visibleLimit, setVisibleLimit] = useState(50);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setError("News is unavailable. Supabase public settings are missing.");
      setLoading(false);
      return;
    }
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    let disposed = false;
    let revision = 0;
    let request = 0;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function refresh() {
      const currentRequest = ++request;
      const currentRevision = revision;
      try {
        const result = await db.from("real_estate_news").select(columns, { count: "exact" })
          .eq("city", "Hyderabad")
          .gte("published_at", new Date(Date.now() - 30 * 86_400_000).toISOString())
          .order("published_at", { ascending: false }).order("id", { ascending: false })
          .range(0, visibleLimit - 1).abortSignal(controller.signal);
        if (disposed || currentRequest !== request) return;
        if (result.error) throw result.error;
        // A realtime INSERT received during a query must not be overwritten by its snapshot.
        if (currentRevision === revision) {
          setItems(latest((result.data ?? []).filter(validNews), visibleLimit));
          setTotal(result.count ?? 0);
          setError(null);
          setLoading(false);
        }
      } catch {
        if (!disposed && currentRequest === request) {
          setError("News could not be refreshed. Retrying automatically.");
          setLoading(false);
        }
      }
    }

    function scheduleRefresh() {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void refresh(); }, 300);
    }

    const channel = db.channel("decode-infra-news")
      .on("postgres_changes", { event: "*", schema: "public", table: "real_estate_news", filter: "city=eq.Hyderabad" }, (payload) => {
        if (disposed) return;
        revision += 1;
        if (payload.eventType === "INSERT" && validNews(payload.new) && inWindow(payload.new)) {
          const incoming = payload.new;
          setItems((current) => latest([...current.filter((row) => row.id !== incoming.id), incoming], visibleLimit));
          setLoading(false);
          setError(null);
        }
        // Reconcile updates/deletes as well, including items displaced from the latest ten.
        scheduleRefresh();
      })
      .subscribe((status) => {
        if (disposed) return;
        setConnected(status === "SUBSCRIBED");
        // Resubscription catches events missed while disconnected.
        if (status === "SUBSCRIBED") void refresh();
      });

    void refresh();
    // One visible-tab refresh per minute provides recovery if Realtime is unavailable.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      disposed = true;
      controller.abort();
      clearInterval(interval);
      clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      void db.removeChannel(channel);
    };
  }, [visibleLimit]);

  return (
    <section className={styles.ticker} aria-labelledby="decode-news-heading" aria-busy={loading}>
      <div className={styles.header}>
        <div><p className={styles.eyebrow}>Decode Infra / Intelligence</p>
          <h1 id="decode-news-heading">Hyderabad, in development.</h1></div>
        <span className={styles.status} role="status">
          <span className={connected ? styles.live : styles.offline} aria-hidden="true" />
          {connected ? "Live updates" : "Connecting · auto refresh"}
        </span>
      </div>
      <p className={styles.intro}>Hyderabad real estate, infrastructure, RERA and city developments from the past 30 days. Newest stories first.</p>
      {loading && <p role="status">Loading the latest news…</p>}
      {error && <p role="status">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No Hyderabad stories are available for the past 30 days yet.</p>}
      <p className={styles.meta} role="status">Showing {items.length} of {total} stories · Rolling 30-day archive</p>
      <ol className={styles.list}>
        {items.map((item) => (
          <li key={item.id} className={styles.card}>
            <div className={styles.tags}><span>{item.city}</span><span>{item.category}</span></div>
            <h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}<span className={styles.srOnly}> (opens in a new tab)</span></a></h3>
            {item.ai_model === "source-excerpt" ? (
              <p className={styles.excerpt}>{item.bullet_summary[1]}</p>
            ) : <ul className={styles.bullets}>{item.bullet_summary.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>}
            <span className={styles.summaryType}>{item.ai_model === "source-excerpt" ? "Source headline / excerpt" : "AI summary"}</span>
            <p className={styles.meta}>{item.source} <span aria-hidden="true">·</span>{" "}
              <time dateTime={item.published_at}>{new Intl.DateTimeFormat("en-IN", {
                dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
              }).format(new Date(item.published_at))} IST</time></p>
          </li>
        ))}
      </ol>
      {items.length < total && <button className={styles.loadMore} onClick={() => setVisibleLimit((limit) => limit + 50)}>Load 50 more stories</button>}
      <p className={styles.footnote}>Source headlines and excerpts are saved even when the free AI quota is reached. AI summaries are labelled. Categories are automatically assigned. Dates come from publishers’ feeds; coverage is best effort. Read the original for full context.</p>
    </section>
  );
}

"""Discover a rolling 30-day Hyderabad archive using date-partitioned RSS searches.

Writes public article metadata only. Import with a trusted server connection;
never put a database write key in the browser or this output file.
"""
from __future__ import annotations

import argparse
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

from ingest import DEFAULT_FEEDS, fetch_feed, google_feed, is_hyderabad, source_record

TOPICS = [
    'Hyderabad ("real estate" OR housing OR property OR developer OR RERA)',
    'Hyderabad (metro OR "ring road" OR HMDA OR GHMC OR infrastructure OR HYDRAA)',
    '(Kokapet OR Neopolis OR Raidurg OR Gachibowli OR Nanakramguda OR Tellapur) (land OR property OR project OR realty)',
    '(Hyderabad OR Secunderabad) (office OR leasing OR commercial OR construction OR rent OR "land auction")',
    '(Hyderabad OR HMDA OR TGRERA OR TSRERA) (registration OR policy OR RERA OR housing OR "22-A")',
    'Hyderabad (site:magicbricks.com/news OR site:realtynxt.com OR site:housing.com/news OR site:squareyards.com/blog OR site:nobroker.in/blog OR site:regnews.in OR site:proppuls.in)',
]


def discover() -> tuple[list[dict], list[dict]]:
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=30)
    feeds = dict(DEFAULT_FEEDS)
    day = start.date()
    while day <= now.date():
        end = min(day + timedelta(days=7), now.date() + timedelta(days=1))
        for index, topic in enumerate(TOPICS):
            feeds[f"Archive {day} / {index + 1}"] = google_feed(f"{topic} after:{(day - timedelta(days=1)).isoformat()} before:{end.isoformat()}")
        day = end
    rows, report = {}, []
    def fetch(name, url):
        with httpx.Client(timeout=15, follow_redirects=True, max_redirects=5,
                          headers={"User-Agent": "DecodeInfraNews/1.0 (RSS aggregator)"}) as http:
            return fetch_feed(http, name, url)
    with ThreadPoolExecutor(max_workers=3) as pool:
        tasks = {pool.submit(fetch, name, url): name for name, url in feeds.items()}
        for task in as_completed(tasks):
            name = tasks[task]
            try:
                articles = task.result()
                selected = [a for a in articles if start <= a.published_at <= now and is_hyderabad(a)]
                for article in selected:
                    rows.setdefault(article.url, source_record(article))
                report.append({"source": name, "status": "ok", "found": len(articles), "relevant": len(selected)})
            except Exception as exc:
                report.append({"source": name, "status": type(exc).__name__})
    unique = {}
    for row in sorted(rows.values(), key=lambda r: "news.google.com" in r["url"]):
        headline = row["title"].removesuffix(" - " + row["source"])
        key = " ".join(re.findall(r"\w+", headline.casefold()))
        unique.setdefault(key, row)
    return sorted(unique.values(), key=lambda r: (r["published_at"], r["url"]), reverse=True), report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=Path('hyderabad-backfill.json'))
    args = parser.parse_args()
    rows, report = discover()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"generated_at": datetime.now(timezone.utc).isoformat(),
                                       "window_days": 30, "rows": rows, "sources": report}, ensure_ascii=False, indent=2))
    print(json.dumps({"articles": len(rows), "healthy_sources": sum(s['status'] == 'ok' for s in report),
                      "failed_sources": sum(s['status'] != 'ok' for s in report), "output": str(args.output)}))


if __name__ == '__main__':
    main()

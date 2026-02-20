#!/usr/bin/env python3
"""API performance benchmark (before/after cache warm-up).

Definition:
- before_ms: first (cold) request latency.
- after_*: warm-cache latency stats from repeated requests.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import statistics
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import httpx


DEFAULT_ENDPOINTS: list[tuple[str, str]] = [
    ("quote_btc", "/api/market/quote/BTC"),
    ("quotes_watchlist", "/api/market/quotes?symbols=AAPL,BTC,ETH,SPX,VNM"),
    ("countries_map", "/api/market/countries"),
    ("country_vn_detail", "/api/market/countries/VN"),
]

LOCAL_SEARCH_ENDPOINT = ("local_search_hanoi", "/api/market/local-search?query=Hanoi%2C%20Vietnam&category=restaurant")


@dataclass
class BenchmarkRow:
    name: str
    path: str
    before_ms: float
    after_avg_ms: float
    after_p50_ms: float
    after_p95_ms: float
    improvement_pct_vs_before: float
    ok: bool
    status_codes: list[int]
    error: str | None = None


def percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    if len(values) == 1:
        return float(values[0])
    sorted_vals = sorted(values)
    idx = p * (len(sorted_vals) - 1)
    lower = int(math.floor(idx))
    upper = int(math.ceil(idx))
    if lower == upper:
        return float(sorted_vals[lower])
    weight = idx - lower
    return float(sorted_vals[lower] * (1 - weight) + sorted_vals[upper] * weight)


async def timed_get(client: httpx.AsyncClient, url: str) -> tuple[float, int]:
    start = time.perf_counter()
    response = await client.get(url, headers={"Cache-Control": "no-cache"})
    elapsed_ms = (time.perf_counter() - start) * 1000
    return elapsed_ms, response.status_code


async def benchmark_endpoint(
    client: httpx.AsyncClient,
    base_url: str,
    endpoint_name: str,
    path: str,
    warm_runs: int,
) -> BenchmarkRow:
    full_url = f"{base_url.rstrip('/')}{path}"
    status_codes: list[int] = []

    try:
        before_ms, before_status = await timed_get(client, full_url)
        status_codes.append(before_status)

        warm_latencies: list[float] = []
        for _ in range(max(1, warm_runs)):
            latency, status = await timed_get(client, full_url)
            warm_latencies.append(latency)
            status_codes.append(status)

        after_avg = statistics.fmean(warm_latencies)
        after_p50 = percentile(warm_latencies, 0.50)
        after_p95 = percentile(warm_latencies, 0.95)
        improvement = ((before_ms - after_p50) / before_ms * 100.0) if before_ms > 0 else 0.0
        ok = all(200 <= s < 300 for s in status_codes)

        return BenchmarkRow(
            name=endpoint_name,
            path=path,
            before_ms=round(before_ms, 2),
            after_avg_ms=round(after_avg, 2),
            after_p50_ms=round(after_p50, 2),
            after_p95_ms=round(after_p95, 2),
            improvement_pct_vs_before=round(improvement, 2),
            ok=ok,
            status_codes=status_codes,
        )
    except Exception as exc:  # pragma: no cover - benchmark script resilience
        return BenchmarkRow(
            name=endpoint_name,
            path=path,
            before_ms=0.0,
            after_avg_ms=0.0,
            after_p50_ms=0.0,
            after_p95_ms=0.0,
            improvement_pct_vs_before=0.0,
            ok=False,
            status_codes=status_codes,
            error=str(exc),
        )


def render_table(rows: list[BenchmarkRow]) -> str:
    headers = [
        "endpoint",
        "before(ms)",
        "after_p50(ms)",
        "after_p95(ms)",
        "improve(%)",
        "ok",
    ]
    lines = [" | ".join(headers), " | ".join(["---"] * len(headers))]
    for row in rows:
        lines.append(
            " | ".join(
                [
                    row.name,
                    f"{row.before_ms:.2f}",
                    f"{row.after_p50_ms:.2f}",
                    f"{row.after_p95_ms:.2f}",
                    f"{row.improvement_pct_vs_before:.2f}",
                    "yes" if row.ok else "no",
                ]
            )
        )
    return "\n".join(lines)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark API latency before/after cache warm-up")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000", help="Base API URL")
    parser.add_argument("--warm-runs", type=int, default=15, help="Number of warm runs per endpoint")
    parser.add_argument("--timeout", type=float, default=25.0, help="Request timeout seconds")
    parser.add_argument("--include-local-search", action="store_true", help="Include OSM local-search benchmark")
    parser.add_argument("--json-out", default="", help="Optional path to write JSON report")
    args = parser.parse_args()

    endpoints = list(DEFAULT_ENDPOINTS)
    if args.include_local_search:
        endpoints.append(LOCAL_SEARCH_ENDPOINT)

    async with httpx.AsyncClient(timeout=args.timeout) as client:
        rows: list[BenchmarkRow] = []
        for name, path in endpoints:
            row = await benchmark_endpoint(client, args.base_url, name, path, args.warm_runs)
            rows.append(row)

    print("# Benchmark Result")
    print(f"- base_url: {args.base_url}")
    print(f"- warm_runs: {args.warm_runs}")
    print("- before = first cold request; after = warm-cache repeated requests")
    print()
    print(render_table(rows))

    payload: dict[str, Any] = {
        "base_url": args.base_url,
        "warm_runs": args.warm_runs,
        "generated_at_epoch": int(time.time()),
        "rows": [asdict(r) for r in rows],
    }

    if args.json_out:
        output_path = Path(args.json_out)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print()
        print(f"Saved JSON report: {output_path}")


if __name__ == "__main__":
    asyncio.run(main())

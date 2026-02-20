"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { geoGraticule10, geoMercator, geoOrthographic, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldData from "world-atlas/countries-110m.json";
import { RiCompass3Line, RiExternalLinkLine, RiSearch2Line } from "@remixicon/react";
import { apiClient } from "@/lib/api";
import type { CountryDetailResponse, CountryMapRow } from "@/lib/types";
import { useVisibilityPolling } from "@/lib/useVisibilityPolling";

type GeometryFeature = {
    id?: number | string;
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: unknown;
};

function asNumber(value: number | null | undefined, digits = 2): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return "--";
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
}

function normalizeNumericCode(code: string | number | undefined): string {
    return String(code ?? "").replace(/^0+/, "").trim();
}

export default function GlobalMapPage() {
    const locale = useLocale();

    const [mapMode, setMapMode] = useState<"3d" | "2d">("3d");
    const [search, setSearch] = useState("");
    const [countries, setCountries] = useState<CountryMapRow[]>([]);
    const [selectedCode, setSelectedCode] = useState("US");
    const [detail, setDetail] = useState<CountryDetailResponse["country"] | null>(null);

    const [dragging, setDragging] = useState(false);
    const [rotation, setRotation] = useState(-25);
    const [pitch, setPitch] = useState(-15);
    const dragPointRef = useRef<{ x: number; y: number } | null>(null);
    const dragDeltaRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
    const dragRafRef = useRef<number | null>(null);
    const [renderMode, setRenderMode] = useState<"optimized" | "baseline">("optimized");
    const [benchmarkRunning, setBenchmarkRunning] = useState(false);
    const [benchmarkResult, setBenchmarkResult] = useState<{
        baselineFps: number;
        optimizedFps: number;
        gainPct: number;
        measuredAt: string;
    } | null>(null);

    const [zoom2d, setZoom2d] = useState(1);
    const [offsetX2d, setOffsetX2d] = useState(0);
    const [offsetY2d, setOffsetY2d] = useState(0);
    const deferredSearch = useDeferredValue(search);

    const labels = {
        vi: {
            search: "Tìm quốc gia...",
            mode3d: "3D Globe",
            mode2d: "2D Map",
            title: "Bản đồ đầu tư toàn cầu",
            subtitle: "Bấm vào quốc gia để xem dữ liệu vĩ mô thật và tín hiệu AI.",
            gdp: "GDP (T USD)",
            gdpPc: "GDP/người (USD)",
            gini: "Gini",
            area: "Diện tích (km²)",
            population: "Dân số",
            electricity: "Điện/người (kWh)",
            btcHolding: "BTC nắm giữ",
            fxForecast: "Hệ số FX dự báo",
            realEstate: "Tiềm năng BĐS",
            aiSignal: "Tín hiệu AI",
            lat: "Vĩ độ",
            lng: "Kinh độ",
            region: "Khu vực",
            capital: "Thủ đô",
            bullish: "Tích cực",
            neutral: "Trung tính",
            cautious: "Thận trọng",
            loading: "Đang tải dữ liệu bản đồ...",
            noData: "Không có dữ liệu map.",
            instruction3d: "Kéo chuột để xoay 3D",
            instruction2d: "Lăn chuột để zoom, kéo để pan 2D",
            north: "B",
            south: "N",
            east: "Đ",
            west: "T",
            openMap: "Mở OpenStreetMap",
            perfTitle: "Benchmark FPS",
            perfRun: "Đo trước/sau",
            perfRunning: "Đang đo...",
            perfBaseline: "Baseline FPS",
            perfOptimized: "Optimized FPS",
            perfGain: "Cải thiện",
            perfMode: "Chế độ render",
            modeOptimized: "Optimized",
            modeBaseline: "Baseline",
        },
        en: {
            search: "Search country...",
            mode3d: "3D Globe",
            mode2d: "2D Map",
            title: "Global Investment Map",
            subtitle: "Click a country to inspect real macro data and AI signals.",
            gdp: "GDP (T USD)",
            gdpPc: "GDP per capita (USD)",
            gini: "Gini",
            area: "Area (km²)",
            population: "Population",
            electricity: "Electricity/capita (kWh)",
            btcHolding: "BTC holding",
            fxForecast: "FX forecast factor",
            realEstate: "Real-estate potential",
            aiSignal: "AI signal",
            lat: "Latitude",
            lng: "Longitude",
            region: "Region",
            capital: "Capital",
            bullish: "Bullish",
            neutral: "Neutral",
            cautious: "Cautious",
            loading: "Loading map data...",
            noData: "No map data.",
            instruction3d: "Drag to rotate 3D globe",
            instruction2d: "Wheel to zoom and drag to pan 2D map",
            north: "N",
            south: "S",
            east: "E",
            west: "W",
            openMap: "Open in OpenStreetMap",
            perfTitle: "FPS Benchmark",
            perfRun: "Measure before/after",
            perfRunning: "Benchmarking...",
            perfBaseline: "Baseline FPS",
            perfOptimized: "Optimized FPS",
            perfGain: "Improvement",
            perfMode: "Render mode",
            modeOptimized: "Optimized",
            modeBaseline: "Baseline",
        },
        es: {
            search: "Buscar pais...",
            mode3d: "Globo 3D",
            mode2d: "Mapa 2D",
            title: "Mapa de Inversion Global",
            subtitle: "Haz clic en un pais para ver datos macro reales y senales AI.",
            gdp: "PIB (T USD)",
            gdpPc: "PIB per capita (USD)",
            gini: "Gini",
            area: "Area (km²)",
            population: "Poblacion",
            electricity: "Electricidad/capita (kWh)",
            btcHolding: "BTC en reserva",
            fxForecast: "Factor FX proyectado",
            realEstate: "Potencial inmobiliario",
            aiSignal: "Senal AI",
            lat: "Latitud",
            lng: "Longitud",
            region: "Region",
            capital: "Capital",
            bullish: "Alcista",
            neutral: "Neutral",
            cautious: "Cauteloso",
            loading: "Cargando datos del mapa...",
            noData: "Sin datos de mapa.",
            instruction3d: "Arrastra para rotar el globo 3D",
            instruction2d: "Rueda para zoom y arrastra para mover el mapa",
            north: "N",
            south: "S",
            east: "E",
            west: "O",
            openMap: "Abrir en OpenStreetMap",
            perfTitle: "Benchmark FPS",
            perfRun: "Medir antes/despues",
            perfRunning: "Midiendo...",
            perfBaseline: "FPS baseline",
            perfOptimized: "FPS optimizado",
            perfGain: "Mejora",
            perfMode: "Modo render",
            modeOptimized: "Optimizado",
            modeBaseline: "Baseline",
        },
    } as const;

    const t = labels[locale as keyof typeof labels] ?? labels.en;

    const worldFeatures = useMemo(() => {
        const topo = worldData as unknown as { objects: { countries: unknown } };
        const geo = feature(worldData as never, topo.objects.countries as never) as unknown;
        if (geo && typeof geo === "object" && "features" in geo) {
            return (geo as { features: GeometryFeature[] }).features;
        }
        return [] as GeometryFeature[];
    }, []);

    const fetchCountries = useCallback(async (signal: AbortSignal) => {
        try {
            const res = await fetch("/api/market/countries", { signal });
            if (!res.ok) return;
            const payload = await res.json();
            const rows = Array.isArray(payload?.countries) ? payload.countries : [];
            const mapped = rows
                .map((row: Record<string, unknown>) => ({
                    code: String(row.code || ""),
                    numeric_code: String(row.numeric_code || ""),
                    name: String(row.name || ""),
                    official_name: String(row.official_name || ""),
                    lat: Number(row.lat || 0),
                    lng: Number(row.lng || 0),
                    area_km2: Number(row.area_km2 || 0),
                    population: Number(row.population || 0),
                    region: String(row.region || ""),
                    subregion: String(row.subregion || ""),
                    capital: String(row.capital || ""),
                    timezones: Array.isArray(row.timezones) ? row.timezones.map(String) : [],
                    currencies: Array.isArray(row.currencies) ? row.currencies.map(String) : [],
                    languages: Array.isArray(row.languages) ? row.languages.map(String) : [],
                    btc_holding: Number(row.btc_holding || 0),
                    fx_forecast_factor: Number(row.fx_forecast_factor || 1),
                    real_estate_potential_pct: Number(row.real_estate_potential_pct || 0),
                    ai_signal: (String(row.ai_signal || "neutral") as CountryMapRow["ai_signal"]),
                }))
                .filter((row: CountryMapRow) => row.code.length === 2);

            if (mapped.length > 0) {
                setCountries(mapped);
                if (!mapped.some((row: CountryMapRow) => row.code === selectedCode)) {
                    setSelectedCode(mapped[0].code);
                }
            }
        } catch {
        }
    }, [selectedCode]);

    useVisibilityPolling(fetchCountries, 60_000);

    useEffect(
        () => () => {
            if (dragRafRef.current !== null) {
                cancelAnimationFrame(dragRafRef.current);
            }
        },
        [],
    );

    const measureFps = useCallback((mode: "optimized" | "baseline", durationMs: number = 2600) => {
        return new Promise<number>((resolve) => {
            setRenderMode(mode);
            requestAnimationFrame(() => {
                let frames = 0;
                let start = 0;
                const tick = (ts: number) => {
                    if (!start) start = ts;
                    frames += 1;
                    setRotation((prev) => prev + 0.55);
                    setPitch((prev) => {
                        const next = prev + (frames % 2 === 0 ? 0.2 : -0.2);
                        return Math.max(-52, Math.min(52, next));
                    });
                    if (ts - start < durationMs) {
                        requestAnimationFrame(tick);
                        return;
                    }
                    const elapsedSec = Math.max(0.001, (ts - start) / 1000);
                    resolve(frames / elapsedSec);
                };
                requestAnimationFrame(tick);
            });
        });
    }, []);

    const runFpsBenchmark = useCallback(async () => {
        if (benchmarkRunning) return;
        setBenchmarkRunning(true);

        const prevMode = renderMode;
        const prevMapMode = mapMode;
        const prevDragging = dragging;

        try {
            setMapMode("3d");
            setDragging(true);
            await new Promise((resolve) => setTimeout(resolve, 120));

            const baselineFps = await measureFps("baseline");
            await new Promise((resolve) => setTimeout(resolve, 160));
            const optimizedFps = await measureFps("optimized");

            const gainPct = baselineFps > 0 ? ((optimizedFps - baselineFps) / baselineFps) * 100 : 0;
            setBenchmarkResult({
                baselineFps: Number(baselineFps.toFixed(2)),
                optimizedFps: Number(optimizedFps.toFixed(2)),
                gainPct: Number(gainPct.toFixed(2)),
                measuredAt: new Date().toISOString(),
            });
        } finally {
            setRenderMode(prevMode);
            setMapMode(prevMapMode);
            setDragging(prevDragging);
            setBenchmarkRunning(false);
        }
    }, [benchmarkRunning, dragging, mapMode, measureFps, renderMode]);

    useEffect(() => {
        let mounted = true;
        (async () => {
            if (!selectedCode) return;
            try {
                const payload = await apiClient.getCountryDetail(selectedCode);
                if (!mounted) return;
                if (payload?.country) {
                    setDetail(payload.country);
                }
            } catch {
                if (mounted) setDetail(null);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [selectedCode]);

    const countryByCode = useMemo(() => {
        const map = new Map<string, CountryMapRow>();
        for (const row of countries) map.set(row.code, row);
        return map;
    }, [countries]);

    const countryByNumeric = useMemo(() => {
        const map = new Map<string, CountryMapRow>();
        for (const row of countries) {
            const key = normalizeNumericCode(row.numeric_code);
            if (key) map.set(key, row);
        }
        return map;
    }, [countries]);

    const filteredCountries = useMemo(() => {
        const q = deferredSearch.trim().toLowerCase();
        if (!q) return countries;
        return countries.filter((country) => country.name.toLowerCase().includes(q) || country.code.toLowerCase().includes(q));
    }, [countries, deferredSearch]);

    const selectedBase = countryByCode.get(selectedCode) || filteredCountries[0] || null;
    const selected = detail || selectedBase;

    const width = 1280;
    const height = 760;
    const projection = useMemo(() => {
        if (mapMode === "3d") {
            return geoOrthographic()
                .clipAngle(90)
                .scale(330)
                .translate([width / 2, height / 2 + 12])
                .rotate([rotation, pitch]);
        }
        return geoMercator()
            .scale(205 * zoom2d)
            .translate([width / 2 + offsetX2d, height / 1.65 + offsetY2d]);
    }, [mapMode, rotation, pitch, zoom2d, offsetX2d, offsetY2d]);

    const path = useMemo(() => geoPath(projection), [projection]);

    const graticulePath = useMemo(() => path(geoGraticule10()) || "", [path]);

    const getFill = (row: CountryMapRow | undefined) => {
        if (!row) return "color-mix(in srgb, var(--surface) 25%, #1e293b)";
        if (row.ai_signal === "bullish") return "rgba(16, 185, 129, 0.66)";
        if (row.ai_signal === "cautious") return "rgba(239, 68, 68, 0.6)";
        return "rgba(168, 85, 247, 0.64)";
    };

    const onMouseDown = (event: React.MouseEvent<SVGSVGElement>) => {
        setDragging(true);
        dragPointRef.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
        if (!dragging) return;
        const lastPoint = dragPointRef.current;
        if (!lastPoint) {
            dragPointRef.current = { x: event.clientX, y: event.clientY };
            return;
        }

        const dx = event.clientX - lastPoint.x;
        const dy = event.clientY - lastPoint.y;
        dragPointRef.current = { x: event.clientX, y: event.clientY };

        if (renderMode === "baseline") {
            if (mapMode === "3d") {
                setRotation((prev) => prev + dx * 0.24);
                setPitch((prev) => Math.max(-55, Math.min(55, prev + dy * 0.12)));
            } else {
                setOffsetX2d((prev) => prev + dx);
                setOffsetY2d((prev) => prev + dy);
            }
            return;
        }

        dragDeltaRef.current = { dx: dragDeltaRef.current.dx + dx, dy: dragDeltaRef.current.dy + dy };

        if (dragRafRef.current !== null) return;
        dragRafRef.current = requestAnimationFrame(() => {
            const frameDx = dragDeltaRef.current.dx;
            const frameDy = dragDeltaRef.current.dy;
            dragDeltaRef.current = { dx: 0, dy: 0 };
            dragRafRef.current = null;

            if (mapMode === "3d") {
                setRotation((prev) => prev + frameDx * 0.24);
                setPitch((prev) => Math.max(-55, Math.min(55, prev + frameDy * 0.12)));
            } else {
                setOffsetX2d((prev) => prev + frameDx);
                setOffsetY2d((prev) => prev + frameDy);
            }
        });
    };

    const onMouseUp = () => {
        setDragging(false);
        dragPointRef.current = null;
    };

    const onWheel = (event: React.WheelEvent<SVGSVGElement>) => {
        if (mapMode !== "2d") return;
        event.preventDefault();
        const next = event.deltaY > 0 ? zoom2d * 0.92 : zoom2d * 1.08;
        setZoom2d(Math.max(0.8, Math.min(5, next)));
    };

    const renderedGeoPaths = useMemo(() => {
        return worldFeatures
            .map((geo, idx) => {
                const d = path(geo as never) || "";
                if (!d) return null;
                const featureKey = normalizeNumericCode(geo.id);
                const row = countryByNumeric.get(featureKey);
                return {
                    key: `geo-${String(geo.id ?? "na")}-${idx}`,
                    d,
                    code: row?.code || "",
                    fill: getFill(row),
                    active: row?.code === selectedCode,
                };
            })
            .filter(Boolean) as Array<{ key: string; d: string; code: string; fill: string; active: boolean }>;
    }, [worldFeatures, path, countryByNumeric, selectedCode]);

    const renderedMarkers = useMemo(() => {
        const markerLimit = renderMode === "baseline" ? 260 : mapMode === "3d" ? 180 : 260;
        return countries
            .slice(0, markerLimit)
            .map((country, idx) => {
                const point = projection([country.lng, country.lat]);
                if (!point) return null;
                const [x, y] = point;
                return {
                    key: `marker-${country.code}-${idx}`,
                    code: country.code,
                    x,
                    y,
                    active: country.code === selectedCode,
                };
            })
            .filter(Boolean) as Array<{ key: string; code: string; x: number; y: number; active: boolean }>;
    }, [countries, mapMode, projection, renderMode, selectedCode]);

    const visibleMarkers = useMemo(() => {
        if (renderMode === "baseline") return renderedMarkers;
        if (!dragging) return renderedMarkers;
        return renderedMarkers.filter((marker) => marker.active);
    }, [dragging, renderMode, renderedMarkers]);

    return (
        <div className="page-container" style={{ paddingTop: 20, paddingBottom: 52, maxWidth: 1460 }}>
            <div style={{ marginBottom: 14 }}>
                <h1 style={{ fontSize: "1.75rem", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 5 }}>{t.title}</h1>
                <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>{t.subtitle}</p>
            </div>

            <div className="card" style={{ padding: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "0.86rem" }}>{t.perfTitle}</strong>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{t.perfMode}:</span>
                        <button className={`btn ${renderMode === "optimized" ? "btn-primary" : ""}`} style={{ padding: "5px 9px", fontSize: "0.72rem" }} onClick={() => setRenderMode("optimized")}>
                            {t.modeOptimized}
                        </button>
                        <button className={`btn ${renderMode === "baseline" ? "btn-primary" : ""}`} style={{ padding: "5px 9px", fontSize: "0.72rem" }} onClick={() => setRenderMode("baseline")}>
                            {t.modeBaseline}
                        </button>
                    </div>
                    <button className="btn btn-primary" style={{ padding: "6px 10px", fontSize: "0.74rem" }} onClick={() => void runFpsBenchmark()} disabled={benchmarkRunning}>
                        {benchmarkRunning ? t.perfRunning : t.perfRun}
                    </button>
                </div>
                {benchmarkResult && (
                    <div style={{ marginTop: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
                            <div className="card" style={{ padding: 8 }}>
                                <small>{t.perfBaseline}</small>
                                <div style={{ fontWeight: 800 }}>{benchmarkResult.baselineFps.toFixed(2)}</div>
                            </div>
                            <div className="card" style={{ padding: 8 }}>
                                <small>{t.perfOptimized}</small>
                                <div style={{ fontWeight: 800 }}>{benchmarkResult.optimizedFps.toFixed(2)}</div>
                            </div>
                            <div className="card" style={{ padding: 8 }}>
                                <small>{t.perfGain}</small>
                                <div style={{ fontWeight: 800, color: benchmarkResult.gainPct >= 0 ? "var(--success)" : "var(--danger)" }}>
                                    {benchmarkResult.gainPct >= 0 ? "+" : ""}
                                    {benchmarkResult.gainPct.toFixed(2)}%
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: 6, fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            {benchmarkResult.measuredAt}
                        </div>
                    </div>
                )}
            </div>

            <div className="card" style={{ padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginBottom: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                        <div style={{ position: "relative" }}>
                            <RiSearch2Line size={16} style={{ position: "absolute", left: 10, top: 10, color: "var(--text-muted)" }} />
                            <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t.search} style={{ paddingLeft: 32 }} />
                        </div>
                        <select className="input" style={{ width: 240 }} value={selectedCode} onChange={(e) => setSelectedCode(e.target.value)}>
                            {filteredCountries.map((country) => (
                                <option key={`${country.code}-${country.name}`} value={country.code}>
                                    {country.code} - {country.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="card" style={{ padding: 4, display: "flex", gap: 4, alignItems: "center", height: "fit-content" }}>
                        <button className={`btn ${mapMode === "3d" ? "btn-primary" : ""}`} style={{ padding: "6px 10px" }} onClick={() => setMapMode("3d")}>{t.mode3d}</button>
                        <button className={`btn ${mapMode === "2d" ? "btn-primary" : ""}`} style={{ padding: "6px 10px" }} onClick={() => setMapMode("2d")}>{t.mode2d}</button>
                    </div>
                </div>

                <div className="global-map-stage" style={{ minHeight: 760 }}>
                    <svg
                        viewBox={`0 0 ${width} ${height}`}
                        style={{ width: "100%", height: "100%", cursor: mapMode === "3d" ? "grab" : "move" }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                        onWheel={onWheel}
                    >
                        <defs>
                            <radialGradient id="oceanGrad" cx="50%" cy="50%" r="58%">
                                <stop offset="0%" stopColor="#1e3a8a" />
                                <stop offset="55%" stopColor="#0b1a4f" />
                                <stop offset="100%" stopColor="#020617" />
                            </radialGradient>
                        </defs>

                        <rect x={0} y={0} width={width} height={height} fill="url(#oceanGrad)" opacity={0.98} />

                        {mapMode === "3d" && (
                            <circle cx={width / 2} cy={height / 2 + 12} r={332} fill="rgba(2, 6, 23, 0.25)" stroke="rgba(226,232,240,0.2)" strokeWidth={1} />
                        )}

                        <path d={graticulePath} fill="none" stroke="rgba(148, 163, 184, 0.22)" strokeWidth={0.75} />

                        {renderedGeoPaths.map((geo) => (
                            <path
                                key={geo.key}
                                d={geo.d}
                                fill={geo.fill}
                                stroke={geo.active ? "#f8fafc" : "rgba(226, 232, 240, 0.4)"}
                                strokeWidth={geo.active ? 1.7 : 0.7}
                                onClick={() => geo.code && setSelectedCode(geo.code)}
                                style={{ cursor: geo.code ? "pointer" : "default", transition: "fill 0.2s ease" }}
                            />
                        ))}

                        {visibleMarkers.map((marker) => (
                            <g key={marker.key} onClick={() => setSelectedCode(marker.code)} style={{ cursor: "pointer" }}>
                                <circle cx={marker.x} cy={marker.y} r={marker.active ? 4.8 : 2.5} fill={marker.active ? "#ffffff" : "#a855f7"} opacity={0.9} />
                                {marker.active && <text x={marker.x + 8} y={marker.y - 6} fill="#f8fafc" fontSize={11} fontWeight={700}>{marker.code}</text>}
                            </g>
                        ))}
                    </svg>

                    <div style={{ position: "absolute", top: 16, right: 16, zIndex: 4 }}>
                        <div className="card" style={{ padding: "8px 10px", background: "color-mix(in srgb, var(--surface) 85%, transparent)" }}>
                            <div style={{ display: "grid", justifyItems: "center", gap: 2, fontSize: "0.78rem", fontWeight: 700 }}>
                                <RiCompass3Line size={16} />
                                <span>{t.north}</span>
                                <div style={{ display: "flex", gap: 22 }}><span>{t.west}</span><span>{t.east}</span></div>
                                <span>{t.south}</span>
                            </div>
                        </div>
                    </div>

                    <div style={{ position: "absolute", bottom: 16, left: 16, zIndex: 4 }}>
                        <div className="card" style={{ padding: "6px 10px", fontSize: "0.78rem", color: "var(--text-secondary)", background: "color-mix(in srgb, var(--surface) 80%, transparent)" }}>
                            {mapMode === "3d" ? t.instruction3d : t.instruction2d}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ marginTop: 14 }}>
                <div className="card" style={{ padding: 16 }}>
                    {!selected ? (
                        <div style={{ color: "var(--text-muted)", fontSize: "0.86rem" }}>{countries.length === 0 ? t.loading : t.noData}</div>
                    ) : (
                        <>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 10 }}>
                                <div>
                                    <div style={{ fontSize: "1.08rem", fontWeight: 800 }}>{selected.name}</div>
                                    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{selected.code} • {selected.official_name || selected.name}</div>
                                </div>
                                <a
                                    href={`https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lng}#map=5/${selected.lat}/${selected.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--primary)", textDecoration: "none", fontSize: "0.8rem", fontWeight: 600 }}
                                >
                                    {t.openMap}
                                    <RiExternalLinkLine size={14} />
                                </a>
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10 }}>
                                <div className="card" style={{ padding: 10 }}><small>{t.gdp}</small><div style={{ fontWeight: 700 }}>{asNumber((selected as CountryDetailResponse["country"]).gdp_trillion_usd, 2)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.gdpPc}</small><div style={{ fontWeight: 700 }}>{asNumber((selected as CountryDetailResponse["country"]).gdp_per_capita_usd, 0)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.gini}</small><div style={{ fontWeight: 700 }}>{asNumber((selected as CountryDetailResponse["country"]).gini, 2)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.population}</small><div style={{ fontWeight: 700 }}>{asNumber((selected as CountryDetailResponse["country"]).population_wb ?? selected.population, 0)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.area}</small><div style={{ fontWeight: 700 }}>{asNumber(selected.area_km2, 0)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.electricity}</small><div style={{ fontWeight: 700 }}>{asNumber((selected as CountryDetailResponse["country"]).electricity_kwh_per_capita, 0)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.btcHolding}</small><div style={{ fontWeight: 700 }}>{asNumber(selected.btc_holding, 0)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.fxForecast}</small><div style={{ fontWeight: 700 }}>{asNumber(selected.fx_forecast_factor, 4)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.realEstate}</small><div style={{ fontWeight: 700 }}>{asNumber(selected.real_estate_potential_pct, 2)}%</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.region}</small><div style={{ fontWeight: 700 }}>{selected.region} / {selected.subregion}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.capital}</small><div style={{ fontWeight: 700 }}>{selected.capital || "--"}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.lat}</small><div style={{ fontWeight: 700 }}>{selected.lat.toFixed(4)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.lng}</small><div style={{ fontWeight: 700 }}>{selected.lng.toFixed(4)}</div></div>
                                <div className="card" style={{ padding: 10 }}><small>{t.aiSignal}</small><div style={{ fontWeight: 700, color: selected.ai_signal === "bullish" ? "var(--success)" : selected.ai_signal === "neutral" ? "var(--warning)" : "var(--danger)" }}>{selected.ai_signal === "bullish" ? t.bullish : selected.ai_signal === "neutral" ? t.neutral : t.cautious}</div></div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

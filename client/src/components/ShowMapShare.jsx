import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, GeoJSON, useMap } from 'react-leaflet';
import { feature } from 'topojson-client';
import 'leaflet/dist/leaflet.css';
import { getHighestBadge } from '../utils/badges';
import { supabase } from '../services/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const GEO_CACHE_KEY = 'skysets_geocache_v1';
let worldAtlasCache = null;
let usAtlasCache = null;
let usStatesGeoCache = null;

const PIN_COLORS = {
    attended: '#f59e0b',
    upcoming: '#38bdf8',
    both: '#a78bfa',
};

// ─── Geocoding ────────────────────────────────────────────────────────────────

function getGeoCache() {
    try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}'); }
    catch { return {}; }
}
function saveGeoCache(cache) {
    try { localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache)); }
    catch {}
}
async function fetchCoords(query) {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
            { headers: { 'User-Agent': 'SkySets.org/1.0 (fan archive)' } }
        );
        const data = await res.json();
        if (data[0]) return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    } catch {}
    return null;
}

// ─── Atlas loaders (CDN, module-level cache) ──────────────────────────────────

async function loadWorldAtlas() {
    if (worldAtlasCache) return worldAtlasCache;
    const res = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json');
    worldAtlasCache = await res.json();
    return worldAtlasCache;
}

async function loadUsAtlas() {
    if (usAtlasCache) return usAtlasCache;
    const res = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
    usAtlasCache = await res.json();
    return usAtlasCache;
}

// ─── Inverse Albers equal-area conic (lower-48 Albers USA parameters) ─────────
// us-atlas stores coordinates in Albers screen-space, not lat/lng.
// These are the exact D3 albersUsa parameters for the lower-48 inset.

function albersInverse(px, py) {
    const D = Math.PI / 180;
    const phi1 = 29.5 * D, phi2 = 45.5 * D, phi0 = 37.5 * D, lam0 = -96 * D;
    const k = 1070, tx = 487.5, ty = 305;
    const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
    const C = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
    const rho0 = Math.sqrt(C - 2 * n * Math.sin(phi0)) / n;
    const x = (px - tx) / k;
    const y = -(py - ty) / k;
    const rho = Math.sqrt(x * x + (rho0 - y) ** 2);
    const theta = Math.atan2(x, rho0 - y);
    const lat = Math.asin(Math.min(1, Math.max(-1, (C - rho * rho * n * n) / (2 * n)))) / D;
    const lng = (theta / n + lam0) / D;
    return [lng, lat];
}

function convertAlbersGeomToWGS84(geom) {
    if (!geom) return geom;
    const convRing = ring => ring.map(([x, y]) => albersInverse(x, y));
    const convRings = rings => rings.map(convRing);
    if (geom.type === 'Polygon') return { ...geom, coordinates: convRings(geom.coordinates) };
    if (geom.type === 'MultiPolygon') return { ...geom, coordinates: geom.coordinates.map(convRings) };
    return geom;
}

// Convert full us-atlas to WGS84 GeoJSON for Leaflet (cached)
async function loadUsStatesWGS84() {
    if (usStatesGeoCache) return usStatesGeoCache;
    const topo = await loadUsAtlas();
    const fc = feature(topo, topo.objects.states);
    // Alaska (id=2) and Hawaii (id=15) have wrong screen positions in Albers USA insets — skip them
    usStatesGeoCache = {
        type: 'FeatureCollection',
        features: fc.features
            .filter(f => f.id !== 2 && f.id !== 15)
            .map(f => ({ ...f, geometry: convertAlbersGeomToWGS84(f.geometry) })),
    };
    return usStatesGeoCache;
}

// ─── Mercator projection ──────────────────────────────────────────────────────

function mercatorNorm(lat, lng) {
    const x = (lng + 180) / 360;
    const sin = Math.sin((lat * Math.PI) / 180);
    const y = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
    return [x, y];
}

// ─── Canvas image generation ──────────────────────────────────────────────────

async function buildShareImage({ pins, pastCount, upcomingCount, highestBadge }) {
    const W = 900, OVERLAY_H = 80, MAP_H = 440, H = MAP_H + OVERLAY_H;

    const [topoData, usAtlasData, logoImg] = await Promise.all([
        loadWorldAtlas(),
        loadUsAtlas(),
        new Promise(res => {
            const img = new Image();
            img.onload = () => res(img);
            img.onerror = () => res(null);
            img.src = window.location.origin + '/logo.png';
        }),
    ]);

    const land = feature(topoData, topoData.objects.land);

    // Compute bounding box from pins
    const norms = pins.map(p => mercatorNorm(p.lat, p.lng));
    let minX = 1, maxX = 0, minY = 1, maxY = 0;
    norms.forEach(([x, y]) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    });
    if (!pins.length) { minX = 0.1; maxX = 0.9; minY = 0.15; maxY = 0.85; }

    const MIN_EXT = 0.12, PAD = 0.05;
    const extX = Math.max(maxX - minX, MIN_EXT);
    const extY = Math.max(maxY - minY, MIN_EXT);
    const cX = (minX + maxX) / 2, cY = (minY + maxY) / 2;
    minX = Math.max(0, cX - extX / 2 - PAD);
    maxX = Math.min(1, cX + extX / 2 + PAD);
    minY = Math.max(0, cY - extY / 2 - PAD);
    maxY = Math.min(1, cY + extY / 2 + PAD);

    // Letterbox to canvas aspect
    const dataAR = (maxX - minX) / (maxY - minY);
    const canvasAR = W / MAP_H;
    if (dataAR > canvasAR) {
        const newH = (maxX - minX) / canvasAR;
        const c = (minY + maxY) / 2;
        minY = Math.max(0, c - newH / 2); maxY = Math.min(1, c + newH / 2);
    } else {
        const newW = (maxY - minY) * canvasAR;
        const c = (minX + maxX) / 2;
        minX = Math.max(0, c - newW / 2); maxX = Math.min(1, c + newW / 2);
    }

    const toXY = (lat, lng) => {
        const [nx, ny] = mercatorNorm(lat, lng);
        return [((nx - minX) / (maxX - minX)) * W, ((ny - minY) / (maxY - minY)) * MAP_H];
    };

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#0e1117';
    ctx.fillRect(0, 0, W, H);

    // Land fill
    const addGeomToPath = (geom) => {
        if (!geom) return;
        const drawRings = (polygon) => polygon.forEach(ring => {
            ring.forEach(([lng, lat], i) => {
                const [x, y] = toXY(lat, lng);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            });
            ctx.closePath();
        });
        if (geom.type === 'Polygon') drawRings(geom.coordinates);
        else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(drawRings);
    };

    ctx.beginPath();
    if (land.type === 'FeatureCollection') land.features.forEach(f => addGeomToPath(f.geometry));
    else addGeomToPath(land.geometry);
    ctx.fillStyle = '#1c2540';
    ctx.fill();
    ctx.strokeStyle = '#263360';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // US state borders — convert Albers screen coords → lat/lng → canvas XY
    const usStates = feature(usAtlasData, usAtlasData.objects.states);
    ctx.beginPath();
    usStates.features
        .filter(f => f.id !== 2 && f.id !== 15)
        .forEach(f => {
            const geom = f.geometry;
            if (!geom) return;
            const drawUsRings = rings => rings.forEach(ring => {
                ring.forEach(([ax, ay], i) => {
                    const [lng, lat] = albersInverse(ax, ay);
                    const [x, y] = toXY(lat, lng);
                    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                });
                ctx.closePath();
            });
            if (geom.type === 'Polygon') drawUsRings(geom.coordinates);
            else if (geom.type === 'MultiPolygon') geom.coordinates.forEach(drawUsRings);
        });
    ctx.strokeStyle = 'rgba(200,185,140,0.3)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Subtle graticule
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 0.5;
    for (let lat = -80; lat <= 80; lat += 30) {
        const [, y] = toXY(lat, 0);
        if (y >= 0 && y <= MAP_H) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    }
    for (let lng = -150; lng <= 180; lng += 60) {
        const [x] = toXY(0, lng);
        if (x >= 0 && x <= W) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, MAP_H); ctx.stroke(); }
    }

    // Pins
    pins.forEach(pin => {
        const [x, y] = toXY(pin.lat, pin.lng);
        if (x < -30 || x > W + 30 || y < -30 || y > MAP_H + 30) return;
        const color = PIN_COLORS[pin.pinType];
        const grd = ctx.createRadialGradient(x, y, 0, x, y, 20);
        grd.addColorStop(0, color + '55');
        grd.addColorStop(1, 'transparent');
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI * 2);
        ctx.fillStyle = grd; ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = '#0e1117'; ctx.lineWidth = 2; ctx.stroke();
    });

    // Footer gradient
    const footerGrd = ctx.createLinearGradient(0, MAP_H - 60, 0, MAP_H);
    footerGrd.addColorStop(0, 'rgba(10,12,20,0)');
    footerGrd.addColorStop(1, 'rgba(10,12,20,0.97)');
    ctx.fillStyle = footerGrd;
    ctx.fillRect(0, MAP_H - 60, W, 60);

    // Footer bar
    ctx.fillStyle = 'rgba(10,12,20,1)';
    ctx.fillRect(0, MAP_H, W, OVERLAY_H);
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, MAP_H); ctx.lineTo(W, MAP_H); ctx.stroke();

    // Logo
    const LOGO = 38, LX = 16, LY = MAP_H + (OVERLAY_H - LOGO) / 2;
    if (logoImg) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(LX, LY, LOGO, LOGO, 6); else ctx.rect(LX, LY, LOGO, LOGO);
        ctx.clip();
        ctx.drawImage(logoImg, LX, LY, LOGO, LOGO);
        ctx.restore();
    }

    // Site name + tagline
    const TX = LX + LOGO + 10;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 16px system-ui, sans-serif';
    ctx.fillText('SkySets.org', TX, MAP_H + 30);
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '400 11px system-ui, sans-serif';
    ctx.fillText('Sturgill Simpson & Johnny Blue Skies setlists', TX, MAP_H + 48);

    // Legend (centered)
    const legendItems = [
        ...(pastCount > 0 ? [{ type: 'attended', label: `${pastCount} Attended` }] : []),
        ...(upcomingCount > 0 ? [{ type: 'upcoming', label: `${upcomingCount} Upcoming` }] : []),
    ];
    ctx.font = '500 11px system-ui, sans-serif';
    const DOT_R = 5, DOT_GAP = 8, ITEM_GAP = 22;
    let legendW = legendItems.reduce((acc, { label }, i) =>
        acc + DOT_R * 2 + DOT_GAP + ctx.measureText(label).width + (i < legendItems.length - 1 ? ITEM_GAP : 0), 0);
    let lx = (W - legendW) / 2;
    const ly = MAP_H + OVERLAY_H / 2;
    legendItems.forEach(({ type, label }, i) => {
        ctx.beginPath(); ctx.arc(lx + DOT_R, ly, DOT_R, 0, Math.PI * 2);
        ctx.fillStyle = PIN_COLORS[type]; ctx.fill();
        lx += DOT_R * 2 + DOT_GAP;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText(label, lx, ly + 4);
        lx += ctx.measureText(label).width + (i < legendItems.length - 1 ? ITEM_GAP : 0);
    });

    // Badge (right-aligned) — "Latest badge unlocked:"
    if (highestBadge) {
        ctx.textAlign = 'right';
        const RX = W - 14;

        ctx.font = '400 9px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.38)';
        ctx.fillText('Latest badge unlocked:', RX, MAP_H + 18);

        ctx.font = '700 13px system-ui, sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(`${highestBadge.emoji} ${highestBadge.name}`, RX, MAP_H + 38);

        ctx.font = '400 10px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.fillText(`${pastCount} shows attended`, RX, MAP_H + 54);

        ctx.textAlign = 'left';
    }

    return canvas.toDataURL('image/png');
}

// ─── Sharing helpers ──────────────────────────────────────────────────────────

async function blobFromDataUrl(dataUrl) {
    const res = await fetch(dataUrl);
    return res.blob();
}

async function uploadToSupabase(blob) {
    const filename = `maps/${Date.now()}_${Math.random().toString(36).slice(2)}.png`;
    try {
        const { error } = await supabase.storage
            .from('map-shares')
            .upload(filename, blob, { contentType: 'image/png', upsert: false });
        if (error) return null;
        const { data } = supabase.storage.from('map-shares').getPublicUrl(filename);
        return data.publicUrl;
    } catch {
        return null;
    }
}

// ─── Leaflet helpers ──────────────────────────────────────────────────────────

function FitBounds({ pins }) {
    const map = useMap();
    useEffect(() => {
        if (!pins.length) return;
        if (pins.length === 1) { map.setView([pins[0].lat, pins[0].lng], 7); return; }
        map.fitBounds(pins.map(p => [p.lat, p.lng]), { padding: [36, 36] });
    }, [pins, map]);
    return null;
}

const stateStyle = () => ({
    color: 'rgba(220,195,140,0.3)',
    weight: 0.8,
    fillOpacity: 0,
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShowMapShare({ pastShows, upcomingShows }) {
    const [pins, setPins] = useState([]);
    const [geocoding, setGeocoding] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [usStatesGeo, setUsStatesGeo] = useState(null);
    const [modalImage, setModalImage] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [fbUploading, setFbUploading] = useState(false);
    const [shareError, setShareError] = useState(null);
    const dialogRef = useRef(null);

    // Load US states WGS84 GeoJSON for Leaflet overlay
    useEffect(() => {
        loadUsStatesWGS84().then(setUsStatesGeo).catch(() => {});
    }, []);

    // ── Geocoding ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const venueMap = new Map();
        const add = (show, type) => {
            if (!show.venues?.city) return;
            const key = `${show.venues.city}|${show.venues.state_country || ''}`;
            const ex = venueMap.get(key);
            if (!ex) venueMap.set(key, { city: show.venues.city, stateCountry: show.venues.state_country, types: new Set([type]) });
            else ex.types.add(type);
        };
        pastShows.forEach(s => add(s, 'attended'));
        upcomingShows.forEach(s => add(s, 'upcoming'));

        const venues = [...venueMap.entries()].map(([, v]) => ({
            city: v.city,
            stateCountry: v.stateCountry,
            pinType: v.types.has('attended') && v.types.has('upcoming') ? 'both'
                   : v.types.has('attended') ? 'attended' : 'upcoming',
        }));

        const buildPins = async () => {
            const cache = getGeoCache();
            const uncached = venues.filter(v => !cache[`${v.city}|${v.stateCountry || ''}`]);
            if (uncached.length > 0) { setGeocoding(true); setProgress({ done: 0, total: uncached.length }); }

            const result = [];
            let done = 0;
            for (const venue of venues) {
                const key = `${venue.city}|${venue.stateCountry || ''}`;
                let coords = cache[key];
                if (!coords) {
                    if (done > 0) await new Promise(r => setTimeout(r, 1100));
                    coords = await fetchCoords([venue.city, venue.stateCountry].filter(Boolean).join(', '));
                    if (coords) { cache[key] = coords; saveGeoCache(cache); }
                    done++;
                    setProgress({ done, total: uncached.length });
                }
                if (coords) result.push({ ...coords, ...venue });
            }
            setPins(result);
            setGeocoding(false);
        };
        buildPins();
    }, [pastShows, upcomingShows]);

    const highestBadge = getHighestBadge(pastShows.length);
    const hasBoth = pins.some(p => p.pinType === 'both');

    // ── Generate + open modal ─────────────────────────────────────────────────
    const openShareModal = useCallback(async () => {
        setGenerating(true);
        setShareError(null);
        try {
            const img = await buildShareImage({
                pins,
                pastCount: pastShows.length,
                upcomingCount: upcomingShows.length,
                highestBadge,
            });
            setModalImage(img);
            dialogRef.current?.showModal();
        } catch (err) {
            console.error('[ShowMapShare] buildShareImage failed:', err);
            setShareError('Could not generate map image. Please try again.');
        }
        setGenerating(false);
    }, [pins, pastShows.length, upcomingShows.length, highestBadge]);

    const closeModal = () => { dialogRef.current?.close(); };

    // ── Share actions ─────────────────────────────────────────────────────────
    const downloadImage = useCallback(() => {
        if (!modalImage) return;
        const a = document.createElement('a');
        a.href = modalImage;
        a.download = 'my-skysets-shows.png';
        a.click();
    }, [modalImage]);

    const shareToInstagram = useCallback(async () => {
        if (!modalImage) return;
        const blob = await blobFromDataUrl(modalImage);
        const file = new File([blob], 'my-skysets-shows.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    text: 'Track your Sturgill Simpson / Johnny Blue Skies shows at skysets.org',
                });
                return;
            } catch {}
        }
        downloadImage();
    }, [modalImage, downloadImage]);

    const shareToFacebook = useCallback(async () => {
        if (!modalImage) return;
        const blob = await blobFromDataUrl(modalImage);
        const file = new File([blob], 'my-skysets-shows.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare?.({ files: [file] })) {
            try {
                await navigator.share({ files: [file], text: 'Track your shows at skysets.org', url: 'https://skysets.org' });
                return;
            } catch {}
        }

        setFbUploading(true);
        const publicUrl = await uploadToSupabase(blob);
        setFbUploading(false);

        if (publicUrl) {
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(publicUrl)}`, '_blank', 'width=600,height=400');
        } else {
            downloadImage();
            window.open('https://www.facebook.com', '_blank');
        }
    }, [modalImage, downloadImage]);

    if (pastShows.length === 0 && upcomingShows.length === 0) return null;

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                    <h3 className="font-display font-bold text-base" style={{ color: 'var(--p-color-primary)' }}>
                        My Show Map
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--p-color-contrast-low)' }}>
                        {pastShows.length} attended · {upcomingShows.length} upcoming
                    </p>
                </div>
                {geocoding && (
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        Locating venues… {progress.done}/{progress.total}
                    </span>
                )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-5">
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: PIN_COLORS.attended }} />
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>Attended</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: PIN_COLORS.upcoming }} />
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>Upcoming</span>
                </div>
                {hasBoth && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 inline-block" style={{ background: PIN_COLORS.both }} />
                        <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>Both</span>
                    </div>
                )}
            </div>

            {/* Interactive Leaflet map */}
            <div className="rounded-xl overflow-hidden" style={{ height: 360, position: 'relative' }}>
                {pins.length > 0 ? (
                    <MapContainer
                        center={[39.5, -98.35]}
                        zoom={4}
                        style={{ height: '100%', width: '100%', background: '#141820' }}
                        scrollWheelZoom={false}
                    >
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            subdomains="abcd"
                            maxZoom={19}
                        />
                        {usStatesGeo && (
                            <GeoJSON
                                key="us-states"
                                data={usStatesGeo}
                                style={stateStyle}
                            />
                        )}
                        <FitBounds pins={pins} />
                        {pins.map((pin, i) => (
                            <CircleMarker
                                key={i}
                                center={[pin.lat, pin.lng]}
                                radius={9}
                                pathOptions={{ fillColor: PIN_COLORS[pin.pinType], color: '#0d0f14', weight: 2, fillOpacity: 0.9 }}
                            >
                                <Tooltip>{pin.city}{pin.stateCountry ? `, ${pin.stateCountry}` : ''}</Tooltip>
                            </CircleMarker>
                        ))}
                    </MapContainer>
                ) : (
                    <div className="h-full flex items-center justify-center" style={{ background: '#141820' }}>
                        <p className="text-sm" style={{ color: 'var(--p-color-contrast-low)' }}>
                            {geocoding ? `Locating venues… ${progress.done}/${progress.total}` : 'No venue data available'}
                        </p>
                    </div>
                )}

                {/* Branding overlay */}
                <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 800,
                    background: 'linear-gradient(to top, rgba(10,12,18,0.92) 0%, rgba(10,12,18,0.5) 55%, transparent 100%)',
                    padding: '40px 12px 10px',
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                    pointerEvents: 'none',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src="/logo.png" alt="" style={{ width: 28, height: 28, borderRadius: 4 }} />
                        <div>
                            <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: 13, lineHeight: 1 }}>SkySets.org</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>
                                Sturgill Simpson &amp; Johnny Blue Skies
                            </div>
                        </div>
                    </div>
                    {highestBadge && (
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, lineHeight: 1.3, marginBottom: 3 }}>
                                Latest badge unlocked:
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                                <span style={{ fontSize: 16, lineHeight: 1 }}>{highestBadge.emoji}</span>
                                <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 11 }}>{highestBadge.name}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
                <button
                    onClick={openShareModal}
                    disabled={generating || geocoding || !pins.length}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    {generating ? 'Building image…' : geocoding ? 'Wait for venues…' : 'Share My Map'}
                </button>
            </div>

            {shareError && (
                <p className="text-xs" style={{ color: '#fbbf24' }}>{shareError}</p>
            )}

            {/* Share modal */}
            <dialog
                ref={dialogRef}
                className="rounded-2xl p-0 border-0 max-w-[95vw] w-full"
                style={{
                    background: '#1a1e26',
                    border: '1px solid rgba(255,255,255,0.12)',
                    maxWidth: 600,
                    boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
                }}
                onClick={e => { if (e.target === dialogRef.current) closeModal(); }}
            >
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-display font-bold text-base" style={{ color: 'var(--p-color-primary)' }}>
                            Share Your Map
                        </h3>
                        <button
                            onClick={closeModal}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors"
                            style={{ color: 'var(--p-color-contrast-low)' }}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {modalImage && (
                        <div className="rounded-xl overflow-hidden border border-white/10">
                            <img src={modalImage} alt="My show map" className="w-full block" />
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={shareToFacebook}
                            disabled={fbUploading}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                            style={{ background: 'rgba(24,119,242,0.1)', border: '1px solid rgba(24,119,242,0.28)', color: '#93c5fd' }}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                            {fbUploading ? 'Uploading…' : 'Share on Facebook'}
                        </button>

                        <button
                            onClick={shareToInstagram}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                            style={{ background: 'linear-gradient(135deg,rgba(131,58,180,0.1),rgba(253,29,29,0.1))', border: '1px solid rgba(131,58,180,0.28)', color: '#d8b4fe' }}
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                            </svg>
                            Share to Instagram
                        </button>

                        <button
                            onClick={downloadImage}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
                            style={{ color: 'var(--p-color-contrast-medium)' }}
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                        </button>
                    </div>

                    <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                        On mobile, both buttons share the image directly via your device's share sheet.
                        On desktop, Facebook uploads the image to share it — Instagram will download it.
                    </p>
                </div>
            </dialog>
        </div>
    );
}

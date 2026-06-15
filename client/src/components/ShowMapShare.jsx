import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import html2canvas from 'html2canvas';
import 'leaflet/dist/leaflet.css';

const GEO_CACHE_KEY = 'skysets_geocache_v1';

function getGeoCache() {
    try { return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}'); }
    catch { return {}; }
}

function setGeoCache(cache) {
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

function FitBounds({ pins }) {
    const map = useMap();
    useEffect(() => {
        if (pins.length === 0) return;
        if (pins.length === 1) {
            map.setView([pins[0].lat, pins[0].lng], 7);
        } else {
            map.fitBounds(pins.map(p => [p.lat, p.lng]), { padding: [36, 36] });
        }
    }, [pins, map]);
    return null;
}

const PIN_COLORS = {
    attended: '#f59e0b',
    upcoming: '#38bdf8',
    both: '#a78bfa',
};

export default function ShowMapShare({ pastShows, upcomingShows }) {
    const [pins, setPins] = useState([]);
    const [geocoding, setGeocoding] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [mapImage, setMapImage] = useState(null);
    const [capturing, setCapturing] = useState(false);
    const [captureError, setCaptureError] = useState(false);
    const mapContainerRef = useRef(null);

    useEffect(() => {
        const venueMap = new Map();

        const addToMap = (show, type) => {
            if (!show.venues?.city) return;
            const key = `${show.venues.city}|${show.venues.state_country || ''}`;
            const existing = venueMap.get(key);
            if (!existing) {
                venueMap.set(key, { city: show.venues.city, stateCountry: show.venues.state_country, types: new Set([type]) });
            } else {
                existing.types.add(type);
            }
        };

        pastShows.forEach(s => addToMap(s, 'attended'));
        upcomingShows.forEach(s => addToMap(s, 'upcoming'));

        const venues = [...venueMap.entries()].map(([key, v]) => ({
            key,
            city: v.city,
            stateCountry: v.stateCountry,
            pinType: v.types.has('attended') && v.types.has('upcoming') ? 'both'
                   : v.types.has('attended') ? 'attended' : 'upcoming',
        }));

        const buildPins = async () => {
            const cache = getGeoCache();
            const uncached = venues.filter(v => !cache[`${v.city}|${v.stateCountry || ''}`]);

            if (uncached.length > 0) {
                setGeocoding(true);
                setProgress({ done: 0, total: uncached.length });
            }

            const result = [];
            let geocodedCount = 0;

            for (const venue of venues) {
                const cacheKey = `${venue.city}|${venue.stateCountry || ''}`;
                let coords = cache[cacheKey];

                if (!coords) {
                    if (geocodedCount > 0) await new Promise(r => setTimeout(r, 1100));
                    const q = [venue.city, venue.stateCountry].filter(Boolean).join(', ');
                    coords = await fetchCoords(q);
                    if (coords) {
                        cache[cacheKey] = coords;
                        setGeoCache(cache);
                    }
                    geocodedCount++;
                    setProgress({ done: geocodedCount, total: uncached.length });
                }

                if (coords) result.push({ ...coords, ...venue });
            }

            setPins(result);
            setGeocoding(false);
        };

        buildPins();
    }, [pastShows, upcomingShows]);

    const captureMap = useCallback(async () => {
        if (!mapContainerRef.current) return;
        setCapturing(true);
        setCaptureError(false);
        try {
            await new Promise(r => setTimeout(r, 600));
            const canvas = await html2canvas(mapContainerRef.current, {
                useCORS: true,
                allowTaint: false,
                scale: 2,
                backgroundColor: '#141820',
                logging: false,
            });
            setMapImage(canvas.toDataURL('image/png'));
        } catch {
            setCaptureError(true);
        }
        setCapturing(false);
    }, []);

    const shareOnFacebook = () => {
        const url = encodeURIComponent('https://skysets.org');
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, '_blank', 'width=600,height=400');
    };

    const shareToInstagram = async () => {
        if (!mapImage) return;
        const text = 'Check out my Sturgill Simpson / Johnny Blue Skies show history! Track yours at skysets.org';

        if (navigator.share) {
            try {
                const blob = await (await fetch(mapImage)).blob();
                const file = new File([blob], 'my-skysets-shows.png', { type: 'image/png' });
                if (navigator.canShare?.({ files: [file] })) {
                    await navigator.share({ files: [file], text });
                    return;
                }
            } catch {}
        }

        const a = document.createElement('a');
        a.href = mapImage;
        a.download = 'my-skysets-shows.png';
        a.click();
    };

    const hasBoth = pins.some(p => p.pinType === 'both');

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
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIN_COLORS.attended, display: 'inline-block' }} />
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>Attended</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIN_COLORS.upcoming, display: 'inline-block' }} />
                    <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>Upcoming</span>
                </div>
                {hasBoth && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIN_COLORS.both, display: 'inline-block' }} />
                        <span className="text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>Both</span>
                    </div>
                )}
            </div>

            {/* Map */}
            <div ref={mapContainerRef} className="rounded-xl overflow-hidden" style={{ height: 380 }}>
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
                            crossOrigin="anonymous"
                        />
                        <FitBounds pins={pins} />
                        {pins.map((pin, i) => (
                            <CircleMarker
                                key={i}
                                center={[pin.lat, pin.lng]}
                                radius={9}
                                pathOptions={{
                                    fillColor: PIN_COLORS[pin.pinType],
                                    color: '#0d0f14',
                                    weight: 2,
                                    fillOpacity: 0.9,
                                }}
                            >
                                <Tooltip>
                                    {pin.city}{pin.stateCountry ? `, ${pin.stateCountry}` : ''}
                                </Tooltip>
                            </CircleMarker>
                        ))}
                    </MapContainer>
                ) : (
                    <div
                        className="h-full flex items-center justify-center"
                        style={{ background: '#141820' }}
                    >
                        <p className="text-sm" style={{ color: 'var(--p-color-contrast-low)' }}>
                            {geocoding
                                ? `Locating venues… ${progress.done}/${progress.total}`
                                : 'No venue location data available'}
                        </p>
                    </div>
                )}
            </div>

            {/* Captured image preview */}
            {mapImage && (
                <div className="rounded-xl overflow-hidden border border-white/10">
                    <img src={mapImage} alt="My show map" className="w-full block" />
                </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3">
                {pins.length > 0 && !mapImage && (
                    <button
                        onClick={captureMap}
                        disabled={capturing || geocoding}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ color: 'var(--p-color-contrast-medium)' }}
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {capturing ? 'Generating…' : geocoding ? 'Wait for venues…' : 'Generate Map Image'}
                    </button>
                )}

                {mapImage && (
                    <button
                        onClick={() => { setMapImage(null); setCaptureError(false); }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-white/10 hover:border-white/20 transition-all"
                        style={{ color: 'var(--p-color-contrast-low)' }}
                    >
                        Regenerate
                    </button>
                )}

                <button
                    onClick={shareOnFacebook}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                    style={{
                        background: 'rgba(24,119,242,0.1)',
                        border: '1px solid rgba(24,119,242,0.25)',
                        color: '#93c5fd',
                    }}
                >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                    Share on Facebook
                </button>

                {mapImage && (
                    <button
                        onClick={shareToInstagram}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                        style={{
                            background: 'linear-gradient(135deg, rgba(131,58,180,0.1), rgba(253,29,29,0.1))',
                            border: '1px solid rgba(131,58,180,0.28)',
                            color: '#d8b4fe',
                        }}
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                        Share to Instagram
                    </button>
                )}
            </div>

            {captureError && (
                <p className="text-xs" style={{ color: '#fbbf24' }}>
                    Image capture failed — try taking a screenshot of the map above, or use the Facebook button to share a link.
                </p>
            )}

            {!mapImage && !captureError && pins.length > 0 && !geocoding && (
                <p className="text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                    Generate the map image to share it. The Facebook button shares a link to skysets.org.
                </p>
            )}
        </div>
    );
}

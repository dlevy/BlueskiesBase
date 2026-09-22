import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PHeading, PText, PSpinner, PInlineNotification, PButtonPure } from '@porsche-design-system/components-react';
import { getPublicProfile } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import SEO from '../components/SEO';

function FactCard({ label, value, sub }) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1e26] px-4 py-3 space-y-0.5">
            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</PText>
            <div className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>{value}</div>
            {sub && <PText size="xs" color="contrast-medium">{sub}</PText>}
        </div>
    );
}

function initials(name) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(w => w[0].toUpperCase())
        .join('');
}

// For plain YYYY-MM-DD show dates — constructed from local y/m/d parts rather than
// passed straight to `new Date()`, which would parse the bare date as UTC midnight
// and can display as the previous day in negative-UTC-offset timezones.
function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// For full ISO timestamps (e.g. profiles.created_at) — these already carry an
// explicit UTC offset, so no manual y/m/d reconstruction is needed here.
function formatDateTime(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function ProfilePage() {
    const { username } = useParams();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setNotFound(false);
        getPublicProfile(username)
            .then(data => {
                if (cancelled) return;
                if (!data) { setNotFound(true); return; }
                setProfile(data);
            })
            .catch(err => {
                console.error('[ProfilePage] Error loading profile:', err);
                if (!cancelled) setError('Failed to load profile');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [username]);

    if (loading) {
        return <div className="flex justify-center items-center py-16"><PSpinner size="medium" /></div>;
    }

    if (notFound) {
        return (
            <div className="px-4 py-16 max-w-lg mx-auto text-center space-y-4">
                <PHeading size="xl" tag="h1">Profile not found</PHeading>
                <PText color="contrast-medium">There's no member with the username "{username}".</PText>
                <Link to="/"><PButtonPure icon="arrow-left">Back to Home</PButtonPure></Link>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="px-4 py-8 max-w-2xl mx-auto">
                <PInlineNotification heading="Error" description={error || 'Something went wrong'} state="error" dismissButton={false} />
            </div>
        );
    }

    const displayLabel = profile.displayName || profile.username;

    return (
        <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
            <SEO title={displayLabel} description={`${displayLabel}'s concert profile on SkySets.org`} />

            {/* Identity card */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                <div className="flex items-start gap-5">
                    {profile.avatarUrl ? (
                        <img
                            src={profile.avatarUrl}
                            alt={displayLabel}
                            className="w-20 h-20 rounded-full object-cover shrink-0 border border-white/10"
                        />
                    ) : (
                        <div
                            className="w-20 h-20 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-2xl border border-white/10"
                            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                        >
                            {initials(displayLabel)}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <PHeading size="xl" tag="h1">{displayLabel}</PHeading>
                        {profile.displayName && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>@{profile.username}</PText>
                        )}
                        {profile.location && (
                            <PText size="small" color="contrast-medium" className="mt-1 block">{profile.location}</PText>
                        )}
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-1 block">
                            Member since {formatDateTime(profile.memberSince)}
                        </PText>

                        {(profile.facebookUrl || profile.redditUrl || profile.instagramUrl) && (
                            <div className="flex flex-wrap gap-3 mt-3">
                                {profile.facebookUrl && (
                                    <a href={profile.facebookUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-medium text-amber-400 hover:opacity-80 transition-opacity">
                                        Facebook →
                                    </a>
                                )}
                                {profile.redditUrl && (
                                    <a href={profile.redditUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-medium text-amber-400 hover:opacity-80 transition-opacity">
                                        Reddit →
                                    </a>
                                )}
                                {profile.instagramUrl && (
                                    <a href={profile.instagramUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-medium text-amber-400 hover:opacity-80 transition-opacity">
                                        Instagram →
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {profile.bio && (
                    <PText size="small" color="contrast-medium" className="mt-4 block" style={{ whiteSpace: 'pre-wrap' }}>
                        {profile.bio}
                    </PText>
                )}
            </div>

            {/* Stats */}
            <div className="space-y-4">
                <PHeading size="md" tag="h2">By the Numbers</PHeading>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <FactCard label="Shows Attended" value={profile.totalShowsAttended} />
                    {profile.firstShow && (
                        <FactCard label="First Show" value={formatDate(profile.firstShow.show_date)} />
                    )}
                    {profile.favoriteShow && (
                        <FactCard
                            label="Favorite Show"
                            value={profile.favoriteShow.artist_name}
                            sub={`${formatDate(profile.favoriteShow.show_date)}${profile.favoriteShow.venues ? ' · ' + profile.favoriteShow.venues.name : ''}`}
                        />
                    )}
                    {profile.favoriteVenue && (
                        <FactCard label="Favorite Venue" value={profile.favoriteVenue.name} sub={profile.favoriteVenue.city} />
                    )}
                    {profile.uniqueCities > 0 && (
                        <FactCard label="Cities Visited" value={`${profile.uniqueCities} cities`} />
                    )}
                    {profile.mostPlayedSong && (
                        <FactCard label="Most-Played Song" value={profile.mostPlayedSong.title} sub={`Seen ${profile.mostPlayedSong.playCount}x`} />
                    )}
                    {profile.liveDebutsWitnessed > 0 && (
                        <FactCard label="Live Debuts Witnessed" value={profile.liveDebutsWitnessed} />
                    )}
                    {profile.tourDebutsWitnessed > 0 && (
                        <FactCard label="Tour Debuts Witnessed" value={profile.tourDebutsWitnessed} />
                    )}
                </div>
            </div>

            {/* Attended shows — only present if this user opted in */}
            {profile.attendedShows && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                    <PHeading size="lg" tag="h2">Shows Attended</PHeading>
                    <div className="mt-4 space-y-2">
                        {profile.attendedShows.map(show => (
                            <Link
                                key={show.id}
                                to={buildShowPath(show)}
                                className="block rounded-xl border border-white/5 bg-white/5 p-4 hover:bg-white/10 hover:border-white/20 transition-all"
                            >
                                <PText weight="semi-bold">{formatDate(show.show_date)}</PText>
                                <PText size="sm" color="contrast-medium">{show.artist_name}</PText>
                                {show.venues && (
                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                        {show.venues.name} · {show.venues.city}, {show.venues.state_country}
                                    </PText>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

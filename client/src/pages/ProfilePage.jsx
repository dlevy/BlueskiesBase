import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PHeading, PText, PSpinner, PInlineNotification, PButtonPure } from '@porsche-design-system/components-react';
import { getPublicProfile, updateCollectionTradeStatus } from '../services/api';
import { buildShowPath } from '../utils/showSlug';
import { useAuth } from '../contexts/AuthContext';
import SEO from '../components/SEO';
import MainNavTabs from '../components/MainNavTabs';
import ShowMapShare from '../components/ShowMapShare';
import Avatar from '../components/Avatar';
import ExpressInterestForm from '../components/ExpressInterestForm';
import { getHighestBadge } from '../utils/badges';

const textareaClass = "w-full rounded-lg border border-white/10 bg-white/5 py-1.5 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500 resize-none";
const btnPrimary = "text-xs px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/18 transition-all disabled:opacity-50 disabled:cursor-not-allowed";
const btnSecondary = "text-xs px-2.5 py-1 rounded-lg border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

// Site-role badges shown on a public profile — driven entirely by profiles.role,
// so any future admin/editor gets the same treatment automatically. Both editors
// and admins are "Curator"; admins additionally get an "Admin" badge alongside it.
const CURATOR_BADGE = { label: 'Curator', emoji: '🏛️', color: '#fbbf24', bg: 'rgba(245,158,11,0.14)', border: 'rgba(245,158,11,0.5)' };
const ADMIN_BADGE = { label: 'Admin', emoji: '🛡️', color: '#f87171', bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.5)' };

function RoleBadge({ badge }) {
    if (!badge) return null;
    return (
        <span
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide shrink-0"
            style={{ background: badge.bg, color: badge.color, border: `1px solid ${badge.border}`, boxShadow: `0 0 14px ${badge.border}` }}
        >
            <span aria-hidden="true">{badge.emoji}</span>
            {badge.label}
        </span>
    );
}

function FactCard({ label, value, sub }) {
    return (
        <div className="rounded-xl border border-white/10 bg-[#1a1e26] px-4 py-3 space-y-0.5">
            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</PText>
            <div className="text-sm font-semibold" style={{ color: 'var(--p-color-primary)' }}>{value}</div>
            {sub && <PText size="xs" color="contrast-medium">{sub}</PText>}
        </div>
    );
}

function formatPosterDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// A poster collection entry's image+date stays a <Link> to the show (as
// before); trade status/controls live in their own footer row below it so a
// Save/Interested button never nests inside that anchor.
function PosterCollectionCard({ entry, isOwnProfile }) {
    const [editing, setEditing] = useState(false);
    const [forTrade, setForTrade] = useState(entry.forTrade);
    const [tradeComment, setTradeComment] = useState(entry.tradeComment || '');
    const [editionType, setEditionType] = useState(entry.editionType || 'original');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [committed, setCommitted] = useState({ forTrade: entry.forTrade, tradeComment: entry.tradeComment, editionType: entry.editionType || 'original' });

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const trimmed = tradeComment.trim() || null;
            await updateCollectionTradeStatus(entry.id, { forTrade, tradeComment: trimmed, editionType });
            setCommitted({ forTrade, tradeComment: trimmed, editionType });
            setEditing(false);
        } catch (err) {
            setError(err.message || 'Failed to update');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setEditing(false);
        setForTrade(committed.forTrade);
        setTradeComment(committed.tradeComment || '');
        setEditionType(committed.editionType || 'original');
        setError(null);
    };

    return (
        <div className="rounded-xl border border-white/5 bg-white/5 overflow-hidden hover:border-white/20 transition-all">
            <Link to={buildShowPath(entry.show)} className="block">
                <div className="relative aspect-[2/3] bg-black/20">
                    <img src={entry.posterUrl} alt={entry.show.artist_name} className="w-full h-full object-cover" />
                    {entry.hasFoil && (
                        <span
                            className="absolute top-1.5 right-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(192,132,252,0.85)', color: '#1a0b2e' }}
                        >
                            Foil
                        </span>
                    )}
                    {(isOwnProfile ? committed.editionType : entry.editionType) === 'ap' && (
                        <span
                            className="absolute top-1.5 left-1.5 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(59,130,246,0.85)', color: '#0a1a2e' }}
                        >
                            AP
                        </span>
                    )}
                </div>
                <div className="p-2 pb-1">
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} ellipsis>
                        {formatPosterDate(entry.show.show_date)}
                    </PText>
                </div>
            </Link>

            <div className="px-2 pb-2">
                {!isOwnProfile && entry.forTrade && (
                    <div className="space-y-1">
                        {entry.tradeComment && (
                            <PText size="xs" color="contrast-medium" className="italic">{entry.tradeComment}</PText>
                        )}
                        <ExpressInterestForm collectionId={entry.id} />
                    </div>
                )}

                {isOwnProfile && !editing && (
                    <div className="space-y-1">
                        {committed.forTrade && (
                            <>
                                <span
                                    className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                    style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                                >
                                    For Trade
                                </span>
                                {committed.tradeComment && (
                                    <PText size="xs" color="contrast-medium" className="italic">{committed.tradeComment}</PText>
                                )}
                            </>
                        )}
                        <button type="button" onClick={() => setEditing(true)} className="block text-xs hover:underline" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            {committed.forTrade ? 'Edit listing' : 'List for trade'}
                        </button>
                    </div>
                )}

                {isOwnProfile && editing && (
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Edition:
                            <select
                                value={editionType}
                                onChange={e => setEditionType(e.target.value)}
                                className="rounded border border-white/10 bg-white/5 py-0.5 px-1 text-xs"
                            >
                                <option value="original">Original</option>
                                <option value="ap">AP (Artist's Proof)</option>
                            </select>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            <input type="checkbox" checked={forTrade} onChange={e => setForTrade(e.target.checked)} className="w-3.5 h-3.5" />
                            Available for trade/sale
                        </label>
                        {forTrade && (
                            <textarea
                                value={tradeComment}
                                onChange={e => setTradeComment(e.target.value)}
                                placeholder="Price, condition, what you'd trade for…"
                                rows={2}
                                className={textareaClass}
                            />
                        )}
                        {error && <p className="text-xs" style={{ color: 'var(--p-color-error)' }}>{error}</p>}
                        <div className="flex gap-2">
                            <button type="button" onClick={handleSave} disabled={saving} className={btnPrimary}>
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button type="button" onClick={handleCancel} disabled={saving} className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
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
    const { profile: viewerProfile } = useAuth();
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
        return (
            <div className="px-4 py-4 md:py-6 max-w-4xl mx-auto">
                <MainNavTabs />
                <div className="flex justify-center items-center py-16"><PSpinner size="medium" /></div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="px-4 py-4 md:py-6 max-w-4xl mx-auto">
                <MainNavTabs />
                <div className="py-12 max-w-lg mx-auto text-center space-y-4">
                    <PHeading size="xl" tag="h1">Profile not found</PHeading>
                    <PText color="contrast-medium">There's no member with the username "{username}".</PText>
                    <Link to="/"><PButtonPure icon="arrow-left">Back to Home</PButtonPure></Link>
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="px-4 py-4 md:py-6 max-w-4xl mx-auto">
                <MainNavTabs />
                <div className="max-w-2xl mx-auto">
                    <PInlineNotification heading="Error" description={error || 'Something went wrong'} state="error" dismissButton={false} />
                </div>
            </div>
        );
    }

    const displayLabel = profile.displayName || profile.username;
    const isCurator = profile.role === 'admin' || profile.role === 'editor';
    const isAdmin = profile.role === 'admin';
    const attendanceBadge = getHighestBadge(profile.totalShowsAttended);
    const isOwnProfile = Boolean(viewerProfile?.username) && viewerProfile.username === profile.username;

    return (
        <div className="px-4 py-4 md:py-6 max-w-4xl mx-auto space-y-6">
            <SEO title={displayLabel} description={`${displayLabel}'s concert profile on SkySets.org`} />

            <MainNavTabs />

            {/* Identity card */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                <div className="flex items-start gap-5">
                    <Avatar url={profile.avatarUrl} name={displayLabel} size="lg" badge={attendanceBadge} />
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2.5 flex-wrap">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <PHeading size="xl" tag="h1">{displayLabel}</PHeading>
                                {isCurator && <RoleBadge badge={CURATOR_BADGE} />}
                                {isAdmin && <RoleBadge badge={ADMIN_BADGE} />}
                            </div>
                            {isOwnProfile && (
                                <Link to="/profile/edit">
                                    <PButtonPure icon="edit">Edit Profile</PButtonPure>
                                </Link>
                            )}
                        </div>
                        {profile.displayName && (
                            <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>@{profile.username}</PText>
                        )}
                        {profile.location && (
                            <PText size="small" color="contrast-medium" className="mt-1 block">{profile.location}</PText>
                        )}
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-1 block">
                            Member since {formatDateTime(profile.memberSince)}
                        </PText>

                        {(profile.facebookUrl || profile.redditUrl || profile.instagramUrl || profile.youtubeUrl) && (
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
                                {profile.youtubeUrl && (
                                    <a href={profile.youtubeUrl} target="_blank" rel="noopener noreferrer"
                                        className="text-xs font-medium text-amber-400 hover:opacity-80 transition-opacity">
                                        YouTube →
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
                </div>
            </div>

            {/* Debuts witnessed — the actual songs + dates, not just a count */}
            {(profile.liveDebuts?.length > 0 || profile.tourDebuts?.length > 0) && (
                <div className="space-y-4">
                    <PHeading size="md" tag="h2">Debuts Witnessed</PHeading>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {profile.liveDebuts?.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5">
                                <PText size="xs" weight="semi-bold" className="uppercase tracking-wide mb-3" style={{ color: '#34d399' }}>
                                    Live Debuts ({profile.liveDebuts.length})
                                </PText>
                                <ul className="space-y-1">
                                    {profile.liveDebuts.map((d, i) => {
                                        const content = (
                                            <>
                                                <PText size="small" ellipsis>{d.title || 'Unknown song'}</PText>
                                                {d.showDate && (
                                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="shrink-0 whitespace-nowrap">
                                                        {formatDate(d.showDate)}
                                                    </PText>
                                                )}
                                            </>
                                        );
                                        return (
                                            <li key={`${d.songId}-${i}`}>
                                                {d.show ? (
                                                    <Link to={buildShowPath(d.show)} className="flex items-center justify-between gap-3 py-1 px-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors">
                                                        {content}
                                                    </Link>
                                                ) : (
                                                    <div className="flex items-center justify-between gap-3 py-1">{content}</div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                        {profile.tourDebuts?.length > 0 && (
                            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-5">
                                <PText size="xs" weight="semi-bold" className="uppercase tracking-wide mb-3" style={{ color: '#22d3ee' }}>
                                    Tour Debuts ({profile.tourDebuts.length})
                                </PText>
                                <ul className="space-y-1">
                                    {profile.tourDebuts.map((d, i) => {
                                        const content = (
                                            <>
                                                <PText size="small" ellipsis>{d.title || 'Unknown song'}</PText>
                                                {d.showDate && (
                                                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="shrink-0 whitespace-nowrap">
                                                        {formatDate(d.showDate)}
                                                    </PText>
                                                )}
                                            </>
                                        );
                                        return (
                                            <li key={`${d.songId}-${i}`}>
                                                {d.show ? (
                                                    <Link to={buildShowPath(d.show)} className="flex items-center justify-between gap-3 py-1 px-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors">
                                                        {content}
                                                    </Link>
                                                ) : (
                                                    <div className="flex items-center justify-between gap-3 py-1">{content}</div>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Poster collection */}
            {profile.posterCollection?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                    <PHeading size="lg" tag="h2">Poster Collection</PHeading>
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                        {profile.posterCollection.map(entry => (
                            <PosterCollectionCard key={entry.id} entry={entry} isOwnProfile={isOwnProfile} />
                        ))}
                    </div>
                </div>
            )}

            {/* Posters wanted — a wishlist, distinct from the collection above */}
            {profile.postersWanted?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6">
                    <PHeading size="lg" tag="h2">Posters Wanted</PHeading>
                    <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-1 block">
                        Looking to find a poster for these shows
                    </PText>
                    <ul className="mt-4 space-y-1">
                        {profile.postersWanted.map(entry => (
                            <li key={entry.id}>
                                <Link
                                    to={buildShowPath(entry.show)}
                                    className="flex items-center justify-between gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <div className="min-w-0">
                                        <PText size="small" weight="semi-bold" ellipsis>{entry.show.artist_name}</PText>
                                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                            {formatDate(entry.show.show_date)}{entry.show.venues ? ` · ${entry.show.venues.name}` : ''}
                                        </PText>
                                    </div>
                                    {entry.variant && entry.variant !== 'any' && (
                                        <span
                                            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
                                            style={{ background: 'rgba(192,132,252,0.15)', color: '#c084fc' }}
                                        >
                                            {entry.variant}
                                        </span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Show map — only present if this user opted in to sharing attendance */}
            {profile.attendedShows && (
                <ShowMapShare pastShows={profile.attendedShows} upcomingShows={[]} title={`${displayLabel}'s Show Map`} />
            )}

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

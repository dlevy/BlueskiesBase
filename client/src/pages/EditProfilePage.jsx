import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PHeading, PText, PButton, PInlineNotification } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import {
    updateMyProfile, uploadAvatar, getUserStats,
    getAllPosters, getMyPosterCollection, addToPosterCollection, removeFromPosterCollection,
} from '../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";
const selectClass = "w-full rounded-lg border border-white/10 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent";
const labelClass = "block text-xs font-medium mb-1.5";

function formatDate(dateString) {
    const [year, month, day] = dateString.split('-');
    return new Date(year, month - 1, day).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function EditProfilePage() {
    const { user, profile, getToken, refreshProfile } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        displayName: '',
        location: '',
        bio: '',
        facebookUrl: '',
        redditUrl: '',
        instagramUrl: '',
        showAttendancePublic: false,
        favoriteShowId: '',
        favoriteVenueId: '',
    });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [pastShows, setPastShows] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const [allPosters, setAllPosters] = useState([]);
    const [myCollection, setMyCollection] = useState([]);
    const [selectedPosterId, setSelectedPosterId] = useState('');
    const [posterError, setPosterError] = useState('');

    useEffect(() => {
        if (!user) navigate('/member-login');
    }, [user, navigate]);

    // Populate the form from `profile` exactly once. `profile` can get a brand-new
    // object reference from AuthContext for reasons that have nothing to do with an
    // actual save here — e.g. a SIGNED_IN event fired by another tab refreshing its
    // token re-fetches the profile row. Re-running this on every such reference
    // change would silently wipe out whatever the user had picked/typed but not yet
    // saved (this is exactly what was happening to favorite show/venue: the effect
    // reset the form back to the still-null saved value right before submit).
    const initializedRef = useRef(false);
    useEffect(() => {
        if (!profile || initializedRef.current) return;
        initializedRef.current = true;
        setFormData(prev => ({
            ...prev,
            displayName: profile.display_name || '',
            location: profile.location || '',
            bio: profile.bio || '',
            facebookUrl: profile.facebook_url || '',
            redditUrl: profile.reddit_url || '',
            instagramUrl: profile.instagram_url || '',
            showAttendancePublic: profile.show_attendance_public || false,
            favoriteShowId: profile.favorite_show_id || '',
            favoriteVenueId: profile.favorite_venue_id || '',
        }));
        setAvatarPreview(profile.avatar_url || null);
    }, [profile]);

    // Favorite show/venue can only be picked from shows the user has actually
    // attended (validated server-side too, not just by limiting the picker options).
    useEffect(() => {
        if (!user) return;
        getUserStats()
            .then(data => {
                const todayStr = new Date().toISOString().slice(0, 10);
                const past = (data.attendedShows || [])
                    .filter(s => s?.show_date && s.show_date <= todayStr)
                    .sort((a, b) => b.show_date.localeCompare(a.show_date));
                setPastShows(past);
            })
            .catch(err => console.error('[EditProfilePage] Error loading attended shows:', err));
    }, [user]);

    const loadPosterCollection = () => {
        getMyPosterCollection()
            .then(data => setMyCollection(data.collection || []))
            .catch(err => console.error('[EditProfilePage] Error loading poster collection:', err));
    };

    useEffect(() => {
        if (!user) return;
        getAllPosters()
            .then(data => setAllPosters(data.posters || []))
            .catch(err => console.error('[EditProfilePage] Error loading posters:', err));
        loadPosterCollection();
    }, [user]);

    const ownedPosterIds = new Set(myCollection.map(c => c.user_posters?.id));
    const availablePosters = allPosters.filter(p => !ownedPosterIds.has(p.id));

    const handleAddPoster = async () => {
        if (!selectedPosterId) return;
        setPosterError('');
        try {
            await addToPosterCollection(selectedPosterId);
            setSelectedPosterId('');
            loadPosterCollection();
        } catch (err) {
            console.error('[EditProfilePage] Error adding poster:', err);
            setPosterError(err.message || 'Failed to add poster');
        }
    };

    const handleRemovePoster = async (entryId) => {
        try {
            await removeFromPosterCollection(entryId);
            loadPosterCollection();
        } catch (err) {
            console.error('[EditProfilePage] Error removing poster:', err);
            setPosterError(err.message || 'Failed to remove poster');
        }
    };

    const venueOptions = [];
    const seenVenueIds = new Set();
    for (const show of pastShows) {
        const v = show.venues;
        if (v?.id && !seenVenueIds.has(v.id)) {
            seenVenueIds.add(v.id);
            venueOptions.push(v);
        }
    }
    venueOptions.sort((a, b) => a.name.localeCompare(b.name));

    if (!user || !profile) return null;

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleAvatarSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { setError('Avatar image must be less than 5MB'); return; }
        if (!file.type.startsWith('image/')) { setError('Only image files are allowed'); return; }
        setError('');
        setAvatarFile(file);
        setAvatarPreview(URL.createObjectURL(file));
    };

    // Tolerates a protocol-less URL (e.g. "facebook.com/name", very natural to type)
    // rather than rejecting the whole save over it. Returns the corrected URL (with
    // https:// added if it was missing), or null if the field was left blank.
    // Throws if the value still isn't a valid URL for the expected host.
    const normalizeUrl = (url, requiredHost, label) => {
        const trimmed = url.trim();
        if (!trimmed) return null;
        const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        try {
            const parsed = new URL(withProtocol);
            if (!parsed.hostname.toLowerCase().includes(requiredHost)) throw new Error();
        } catch {
            throw new Error(`Please enter a valid ${label} URL`);
        }
        return withProtocol;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        let facebookUrl, redditUrl, instagramUrl;
        try {
            facebookUrl = normalizeUrl(formData.facebookUrl, 'facebook.com', 'Facebook') || '';
            redditUrl = normalizeUrl(formData.redditUrl, 'reddit.com', 'Reddit') || '';
            instagramUrl = normalizeUrl(formData.instagramUrl, 'instagram.com', 'Instagram') || '';
        } catch (err) {
            setError(err.message);
            return;
        }

        setSaving(true);
        try {
            await updateMyProfile({ ...formData, facebookUrl, redditUrl, instagramUrl });
            if (avatarFile) {
                await uploadAvatar(avatarFile);
            }
            await refreshProfile();
            setAvatarFile(null);
            setFormData(prev => ({ ...prev, facebookUrl, redditUrl, instagramUrl }));
            setSuccess(true);
        } catch (err) {
            console.error('[EditProfilePage] Error saving profile:', err);
            setError(err.message || 'Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="px-4 py-8 max-w-2xl mx-auto space-y-6">
            <div className="flex items-center justify-between gap-4">
                <PHeading size="2xl" tag="h1">Edit Profile</PHeading>
                {profile.username && (
                    <Link to={`/profile/${profile.username}`}>
                        <PText size="small" style={{ color: 'var(--p-color-info)' }}>View my public profile →</PText>
                    </Link>
                )}
            </div>

            <PText size="small" color="contrast-medium">
                Everything below is optional and hidden until you fill it in — your shows-attended count and other stats are already visible on your public profile regardless.
            </PText>

            {error && <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />}
            {success && <PInlineNotification heading="Saved" description="Your profile has been updated." state="success" dismissButton={false} />}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-5">
                <div className="flex items-center gap-4">
                    {avatarPreview ? (
                        <img src={avatarPreview} alt="Avatar preview" className="w-16 h-16 rounded-full object-cover border border-white/10" />
                    ) : (
                        <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center text-xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                            No photo
                        </div>
                    )}
                    <div>
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Avatar</label>
                        <input type="file" accept="image/*" onChange={handleAvatarSelect} className="text-xs" />
                    </div>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Display Name</label>
                    <input type="text" name="displayName" value={formData.displayName} onChange={handleChange}
                        placeholder="Shown instead of your username" className={inputClass} maxLength={80} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Location</label>
                    <input type="text" name="location" value={formData.location} onChange={handleChange}
                        placeholder="e.g. Nashville, TN" className={inputClass} maxLength={100} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Bio</label>
                    <textarea name="bio" value={formData.bio} onChange={handleChange} rows="4"
                        placeholder="A few words about you" className={inputClass + ' resize-none'} maxLength={500} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Favorite Show</label>
                    <select name="favoriteShowId" value={formData.favoriteShowId} onChange={handleChange}
                        className={selectClass} style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                        <option value="">— None —</option>
                        {pastShows.map(show => (
                            <option key={show.id} value={show.id}>
                                {formatDate(show.show_date)} — {show.artist_name}{show.venues ? ` @ ${show.venues.name}` : ''}
                            </option>
                        ))}
                    </select>
                    {pastShows.length === 0 && (
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }} className="mt-1 block">
                            Mark a show as attended to pick a favorite.
                        </PText>
                    )}
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Favorite Venue</label>
                    <select name="favoriteVenueId" value={formData.favoriteVenueId} onChange={handleChange}
                        className={selectClass} style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                        <option value="">— None —</option>
                        {venueOptions.map(v => (
                            <option key={v.id} value={v.id}>{v.name} — {v.city}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Facebook URL</label>
                    <input type="url" name="facebookUrl" value={formData.facebookUrl} onChange={handleChange}
                        placeholder="https://facebook.com/yourname" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Reddit URL</label>
                    <input type="url" name="redditUrl" value={formData.redditUrl} onChange={handleChange}
                        placeholder="https://reddit.com/user/yourname" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Instagram URL</label>
                    <input type="url" name="instagramUrl" value={formData.instagramUrl} onChange={handleChange}
                        placeholder="https://instagram.com/yourname" className={inputClass} />
                </div>

                <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" name="showAttendancePublic" checked={formData.showAttendancePublic}
                        onChange={handleChange} className="w-4 h-4 mt-0.5" />
                    <span>
                        <PText size="small" weight="semi-bold">Make my show list public</PText>
                        <PText size="xs" color="contrast-medium" className="block">
                            Shows your itemized list of attended shows (dates/venues) on your public profile. Your shows-attended count and other stats are already public either way.
                        </PText>
                    </span>
                </label>

                <PButton type="submit" loading={saving}>Save Profile</PButton>
            </form>

            {/* Poster Collection — its own section since it's a separate save action
                (each add/remove happens immediately, not on form submit) */}
            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
                <div>
                    <PHeading size="lg" tag="h2">My Poster Collection</PHeading>
                    <PText size="small" color="contrast-medium">
                        Mark which show posters you own — pick the regular or foil edition specifically if a show has both. Shown on your public profile.
                    </PText>
                </div>

                {posterError && <PInlineNotification heading="Error" description={posterError} state="error" dismissButton={false} />}

                {myCollection.length > 0 && (
                    <div className="space-y-2">
                        {myCollection.map(entry => {
                            const poster = entry.user_posters;
                            const show = poster?.shows;
                            return (
                                <div key={entry.id} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                                    {poster?.poster_url && (
                                        <img src={poster.poster_url} alt="" className="w-12 h-16 object-cover rounded shrink-0 border border-white/10" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        {show ? (
                                            <>
                                                <div className="flex items-center gap-1.5">
                                                    <PText size="small" weight="semi-bold" ellipsis>{show.artist_name}</PText>
                                                    {poster?.is_foil && (
                                                        <span
                                                            className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0"
                                                            style={{ background: 'rgba(192,132,252,0.15)', color: '#c084fc' }}
                                                        >
                                                            Foil
                                                        </span>
                                                    )}
                                                </div>
                                                <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>
                                                    {formatDate(show.show_date)}{show.venues ? ` · ${show.venues.name}` : ''}
                                                </PText>
                                            </>
                                        ) : (
                                            <PText size="small" color="contrast-medium">Poster's show unavailable</PText>
                                        )}
                                    </div>
                                    <PText
                                        size="xs"
                                        className="shrink-0 cursor-pointer hover:opacity-80"
                                        style={{ color: 'var(--p-color-notification-error)' }}
                                        onClick={() => handleRemovePoster(entry.id)}
                                    >
                                        Remove
                                    </PText>
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-white/10">
                    <div className="flex-1 min-w-[240px]">
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Add a poster</label>
                        <select value={selectedPosterId} onChange={e => setSelectedPosterId(e.target.value)}
                            className={selectClass} style={{ background: 'var(--p-color-canvas)', color: 'var(--p-color-primary)' }}>
                            <option value="">— Select a poster —</option>
                            {availablePosters.map(p => (
                                <option key={p.id} value={p.id}>
                                    {p.shows
                                        ? `${formatDate(p.shows.show_date)} — ${p.shows.artist_name}${p.shows.venues ? ` @ ${p.shows.venues.name}, ${p.shows.venues.city}` : ''}${p.is_foil ? ' (Foil)' : ''}`
                                        : 'Untitled'}
                                </option>
                            ))}
                        </select>
                    </div>
                    <PButton type="button" size="small" disabled={!selectedPosterId} onClick={handleAddPoster}>Add</PButton>
                </div>
            </div>
        </div>
    );
}

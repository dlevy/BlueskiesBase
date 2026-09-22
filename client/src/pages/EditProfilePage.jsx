import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PHeading, PText, PButton, PInlineNotification } from '@porsche-design-system/components-react';
import { useAuth } from '../contexts/AuthContext';
import { updateMyProfile, uploadAvatar } from '../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";
const labelClass = "block text-xs font-medium mb-1.5";

export default function EditProfilePage() {
    const { user, profile, getToken, refreshProfile } = useAuth();
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        displayName: '',
        location: '',
        bio: '',
        facebookUrl: '',
        redditUrl: '',
        showAttendancePublic: false,
    });
    const [avatarFile, setAvatarFile] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!user) navigate('/member-login');
    }, [user, navigate]);

    useEffect(() => {
        if (!profile) return;
        setFormData({
            displayName: profile.display_name || '',
            location: profile.location || '',
            bio: profile.bio || '',
            facebookUrl: profile.facebook_url || '',
            redditUrl: profile.reddit_url || '',
            showAttendancePublic: profile.show_attendance_public || false,
        });
        setAvatarPreview(profile.avatar_url || null);
    }, [profile]);

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

    const validateUrl = (url, requiredHost, label) => {
        if (!url.trim()) return true;
        try {
            const parsed = new URL(url.trim());
            if (!parsed.hostname.toLowerCase().includes(requiredHost)) throw new Error();
            return true;
        } catch {
            setError(`Please enter a valid ${label} URL`);
            return false;
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess(false);

        if (!validateUrl(formData.facebookUrl, 'facebook.com', 'Facebook')) return;
        if (!validateUrl(formData.redditUrl, 'reddit.com', 'Reddit')) return;

        setSaving(true);
        try {
            await updateMyProfile(formData);
            if (avatarFile) {
                await uploadAvatar(avatarFile);
            }
            await refreshProfile();
            setAvatarFile(null);
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
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Facebook URL</label>
                    <input type="url" name="facebookUrl" value={formData.facebookUrl} onChange={handleChange}
                        placeholder="https://facebook.com/yourname" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Reddit URL</label>
                    <input type="url" name="redditUrl" value={formData.redditUrl} onChange={handleChange}
                        placeholder="https://reddit.com/user/yourname" className={inputClass} />
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
        </div>
    );
}

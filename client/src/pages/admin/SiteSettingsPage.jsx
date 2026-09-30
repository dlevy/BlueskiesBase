import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getSiteSettings, updateSiteSettings } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const labelClass = "block text-xs font-medium mb-1.5";

export default function SiteSettingsPage() {
    const { isAdmin } = useAuth();
    const [headerTitle, setHeaderTitle] = useState('');
    const [headerSubtitle, setHeaderSubtitle] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!isAdmin) { setLoading(false); return; }
        getSiteSettings()
            .then(data => {
                setHeaderTitle(data.headerTitle || '');
                setHeaderSubtitle(data.headerSubtitle || '');
            })
            .catch(err => {
                console.error('Error loading site settings:', err);
                setError('Failed to load site settings');
            })
            .finally(() => setLoading(false));
    }, [isAdmin]);

    if (!isAdmin) {
        return (
            <PText color="contrast-medium">
                Site settings are restricted to full admins.
            </PText>
        );
    }

    if (loading) return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await updateSiteSettings({ headerTitle, headerSubtitle });
            setSuccess(true);
        } catch (err) {
            console.error('Error saving site settings:', err);
            setError(err.message || 'Failed to save site settings');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <PHeading size="2xl" tag="h1">Site Settings</PHeading>
                <PText size="small" color="contrast-medium">
                    Edit the text shown in the header on every page
                </PText>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}
            {success && (
                <PInlineNotification heading="Saved" description="The header has been updated." state="success" dismissButton={false} />
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6 max-w-2xl">
                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Header Title <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" value={headerTitle} onChange={e => setHeaderTitle(e.target.value)}
                        required maxLength={200} className={inputClass} />
                    <PText size="x-small" color="contrast-medium">The bold line next to the logo</PText>
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Header Subtitle
                    </label>
                    <input type="text" value={headerSubtitle} onChange={e => setHeaderSubtitle(e.target.value)}
                        maxLength={300} className={inputClass} />
                    <PText size="x-small" color="contrast-medium">
                        The smaller line underneath — desktop only, hidden if left blank. Optional.
                    </PText>
                </div>

                <div className="pt-2 border-t border-white/10">
                    <PButton type="submit" loading={saving}>Save</PButton>
                </div>
            </form>
        </div>
    );
}

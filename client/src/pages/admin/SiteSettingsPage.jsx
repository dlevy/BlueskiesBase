import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getSiteSettings, updateSiteSettings } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import AnnouncementBanner from '../../components/AnnouncementBanner';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const labelClass = "block text-xs font-medium mb-1.5";

const MAX_FOOTER_LINKS = 8;
const DEFAULT_BANNER = { enabled: true, prefixText: '', linkText: '', linkUrl: '', suffixText: '', color: '#fbbf24' };

export default function SiteSettingsPage() {
    const { isAdmin } = useAuth();
    const [headerTitle, setHeaderTitle] = useState('');
    const [headerSubtitle, setHeaderSubtitle] = useState('');
    const [footerLinks, setFooterLinks] = useState([]);
    const [banner, setBanner] = useState(DEFAULT_BANNER);
    const [bannerError, setBannerError] = useState('');
    const [newItemText, setNewItemText] = useState('');
    const [newItemUrl, setNewItemUrl] = useState('');
    const [linkFormError, setLinkFormError] = useState('');
    const [editingIndex, setEditingIndex] = useState(null);
    const [editText, setEditText] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const [editError, setEditError] = useState('');
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
                setFooterLinks(data.footerLinks || []);
                setBanner({ ...DEFAULT_BANNER, ...(data.banner || {}) });
            })
            .catch(err => {
                console.error('Error loading site settings:', err);
                setError('Failed to load site settings');
            })
            .finally(() => setLoading(false));
    }, [isAdmin]);

    const handleAddFooterLink = () => {
        const text = newItemText.trim();
        if (!text) { setLinkFormError('Text is required'); return; }
        const url = newItemUrl.trim();
        if (url) {
            try { new URL(url); } catch { setLinkFormError('Please enter a valid URL'); return; }
        }
        setLinkFormError('');
        setFooterLinks(prev => [...prev, { text, url: url || null }]);
        setNewItemText('');
        setNewItemUrl('');
    };

    const removeFooterLink = (index) => {
        setFooterLinks(prev => prev.filter((_, i) => i !== index));
        if (editingIndex === index) setEditingIndex(null);
    };

    const startEditFooterLink = (index) => {
        setEditingIndex(index);
        setEditText(footerLinks[index].text);
        setEditUrl(footerLinks[index].url || '');
        setEditError('');
    };

    const cancelEditFooterLink = () => {
        setEditingIndex(null);
        setEditError('');
    };

    const saveEditFooterLink = () => {
        const text = editText.trim();
        if (!text) { setEditError('Text is required'); return; }
        const url = editUrl.trim();
        if (url) {
            try { new URL(url); } catch { setEditError('Please enter a valid URL'); return; }
        }
        setFooterLinks(prev => prev.map((item, i) => i === editingIndex ? { text, url: url || null } : item));
        setEditingIndex(null);
        setEditError('');
    };

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
        setBannerError('');
        if (Boolean(banner.linkText.trim()) !== Boolean(banner.linkUrl.trim())) {
            setBannerError('Link text and link URL must be given together — fill in both or neither.');
            return;
        }
        if (banner.linkUrl.trim()) {
            try { new URL(banner.linkUrl.trim()); } catch { setBannerError('Please enter a valid link URL'); return; }
        }

        setSaving(true);
        setError(null);
        setSuccess(false);
        try {
            await updateSiteSettings({ headerTitle, headerSubtitle, footerLinks, banner });
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
                    Edit the header text and footer links shown on every page
                </PText>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}
            {success && (
                <PInlineNotification heading="Saved" description="The header and footer have been updated." state="success" dismissButton={false} />
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

                <div className="pt-6 border-t border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)', marginBottom: 0 }}>
                            Announcement Banner
                        </label>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--p-color-contrast-medium)' }}>
                            <input type="checkbox" checked={banner.enabled}
                                onChange={e => setBanner(prev => ({ ...prev, enabled: e.target.checked }))} />
                            Visible on site
                        </label>
                    </div>
                    <PText size="x-small" color="contrast-medium">
                        Shown below the header on every page, no dismiss button — toggle it off above when there's nothing to announce. The middle phrase is optional; fill in both its text and URL to make it a link, or leave both blank for plain text.
                    </PText>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                            <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Before text</label>
                            <input type="text" value={banner.prefixText} onChange={e => setBanner(prev => ({ ...prev, prefixText: e.target.value }))}
                                placeholder="Follow" maxLength={150} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Linked phrase (optional)</label>
                            <input type="text" value={banner.linkText} onChange={e => setBanner(prev => ({ ...prev, linkText: e.target.value }))}
                                placeholder="@jbssetlists" maxLength={100} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>After text</label>
                            <input type="text" value={banner.suffixText} onChange={e => setBanner(prev => ({ ...prev, suffixText: e.target.value }))}
                                placeholder="for face-melting setlists to your IG feed." maxLength={150} className={inputClass} />
                        </div>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Link URL (required if there's a linked phrase)</label>
                            <input type="url" value={banner.linkUrl} onChange={e => setBanner(prev => ({ ...prev, linkUrl: e.target.value }))}
                                placeholder="https://www.instagram.com/jbssetlists/" maxLength={300} className={inputClass} />
                        </div>
                        <div>
                            <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Accent color</label>
                            <div className="flex items-center gap-2">
                                <input type="color" value={banner.color}
                                    onChange={e => setBanner(prev => ({ ...prev, color: e.target.value }))}
                                    className="w-10 h-9 rounded-lg border border-white/10 bg-white/5 cursor-pointer" />
                                <span className="text-xs font-mono" style={{ color: 'var(--p-color-contrast-medium)' }}>{banner.color}</span>
                            </div>
                        </div>
                    </div>
                    {bannerError && (
                        <PText size="x-small" style={{ color: 'var(--p-color-error)' }}>{bannerError}</PText>
                    )}

                    <div>
                        <PText size="x-small" color="contrast-medium" className="block mb-1.5">Preview</PText>
                        <div className="rounded-lg border border-white/10 overflow-hidden">
                            <AnnouncementBanner banner={banner} />
                            {!banner.enabled && (
                                <div className="px-4 py-2 text-xs text-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                                    Hidden — "Visible on site" is off
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="pt-6 border-t border-white/10 space-y-3">
                    <div>
                        <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                            Footer Links
                        </label>
                        <PText size="x-small" color="contrast-medium">
                            Up to {MAX_FOOTER_LINKS} items shown in the site footer, 4 per row. Each has text and an optional link.
                        </PText>
                    </div>

                    {footerLinks.length > 0 && (
                        <div className="space-y-2">
                            {footerLinks.map((item, index) => (
                                editingIndex === index ? (
                                    <div key={index} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                                        <div className="flex flex-wrap items-end gap-2">
                                            <input type="text" value={editText} onChange={e => setEditText(e.target.value)}
                                                placeholder="Text" maxLength={150} className={inputClass} style={{ maxWidth: '240px' }} />
                                            <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                                                placeholder="https://… (optional)" maxLength={300} className={inputClass} style={{ maxWidth: '240px' }} />
                                        </div>
                                        {editError && (
                                            <PText size="x-small" style={{ color: 'var(--p-color-error)' }}>{editError}</PText>
                                        )}
                                        <div className="flex gap-2">
                                            <PButton type="button" onClick={saveEditFooterLink}>Save Item</PButton>
                                            <PButton type="button" variant="secondary" onClick={cancelEditFooterLink}>Cancel</PButton>
                                        </div>
                                    </div>
                                ) : (
                                    <div key={index} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 py-2 px-3">
                                        <div className="text-sm truncate">
                                            <span>{item.text}</span>
                                            {item.url && (
                                                <span className="ml-2 text-xs truncate" style={{ color: 'var(--p-color-contrast-low)' }}>{item.url}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => startEditFooterLink(index)}
                                                className="text-xs hover:opacity-80 transition-opacity"
                                                style={{ color: 'var(--p-color-info)' }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeFooterLink(index)}
                                                className="text-xs hover:opacity-80 transition-opacity"
                                                style={{ color: 'var(--p-color-error)' }}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    )}

                    {linkFormError && (
                        <PText size="x-small" style={{ color: 'var(--p-color-error)' }}>{linkFormError}</PText>
                    )}

                    {footerLinks.length < MAX_FOOTER_LINKS ? (
                        <div className="flex flex-wrap items-end gap-2">
                            <input type="text" value={newItemText} onChange={e => setNewItemText(e.target.value)}
                                placeholder="Text" maxLength={150} className={inputClass} style={{ maxWidth: '240px' }} />
                            <input type="url" value={newItemUrl} onChange={e => setNewItemUrl(e.target.value)}
                                placeholder="https://… (optional)" maxLength={300} className={inputClass} style={{ maxWidth: '240px' }} />
                            <PButton type="button" variant="secondary" onClick={handleAddFooterLink}>Add</PButton>
                        </div>
                    ) : (
                        <PText size="x-small" color="contrast-medium">
                            {MAX_FOOTER_LINKS}/{MAX_FOOTER_LINKS} — remove one to add another.
                        </PText>
                    )}
                </div>

                <div className="pt-2 border-t border-white/10">
                    <PButton type="submit" loading={saving}>Save</PButton>
                </div>
            </form>
        </div>
    );
}

import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification } from '@porsche-design-system/components-react';
import {
    createBandMember, updateBandMember, deleteBandMember, getBandMember,
    uploadBandMemberPhoto, replaceBandMemberTenures, createGearItem, updateGearItem, deleteGearItem,
} from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--p-color-info)] focus:border-transparent placeholder:text-gray-500";
const labelClass = "block text-xs font-medium mb-1.5";
const btnSecondary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

const ROLE_SUGGESTIONS = ['Guitar', 'Bass', 'Drums', 'Keys', 'Vocals', 'Saxophone', 'Lap Steel', 'Pedal Steel', 'Mandolin', 'Fiddle', 'Banjo'];
const CATEGORY_OPTIONS = [
    { value: 'guitar', label: 'Guitar' },
    { value: 'bass', label: 'Bass' },
    { value: 'amp', label: 'Amp' },
    { value: 'pedal', label: 'Pedal' },
    { value: 'drums', label: 'Drums' },
    { value: 'keys', label: 'Keys' },
    { value: 'vocals_mic', label: 'Vocals/Mic' },
    { value: 'other', label: 'Other' },
];
const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map(c => [c.value, c.label]));

const blankGearForm = { category: 'guitar', make: '', model: '', year: '', notes: '', start_date: '', end_date: '', isCurrent: true, photoFile: null };

export default function BandMemberForm({ member, onClose }) {
    const { isAdmin } = useAuth();
    const [savedMember, setSavedMember] = useState(member);
    const [formData, setFormData] = useState({ name: member?.name || '', bio: member?.bio || '' });
    const [roles, setRoles] = useState(member?.roles || []);
    const [newRole, setNewRole] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const [photoFile, setPhotoFile] = useState(null);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);

    const [tenureRows, setTenureRows] = useState([]);
    const [savingTenures, setSavingTenures] = useState(false);

    const [gearForm, setGearForm] = useState(null); // null = hidden; blankGearForm shape when open
    const [savingGear, setSavingGear] = useState(false);

    useEffect(() => {
        setTenureRows((savedMember?.band_member_tenures || []).map(t => ({
            start_date: t.start_date, end_date: t.end_date || '', isCurrent: !t.end_date,
        })));
    }, [savedMember?.id]);

    const refreshMember = async () => {
        const { member: fresh } = await getBandMember(savedMember.id);
        setSavedMember(fresh);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleAddRole = () => {
        const trimmed = newRole.trim();
        if (!trimmed || roles.includes(trimmed)) return;
        setRoles(prev => [...prev, trimmed]);
        setNewRole('');
    };
    const removeRole = (role) => setRoles(prev => prev.filter(r => r !== role));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            if (savedMember) {
                const { member: updated } = await updateBandMember(savedMember.id, { name: formData.name, bio: formData.bio, roles });
                setSavedMember(prev => ({ ...prev, ...updated }));
            } else {
                const { member: created } = await createBandMember({ name: formData.name, bio: formData.bio, roles });
                setSavedMember(created);
            }
        } catch (err) {
            console.error('Error saving band member:', err);
            setError(err.message || 'Failed to save band member');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        setSaving(true);
        setError(null);
        try {
            await deleteBandMember(savedMember.id);
            onClose();
        } catch (err) {
            console.error('Error deleting band member:', err);
            setError(err.message || 'Failed to delete band member');
            setShowDeleteConfirm(false);
        } finally {
            setSaving(false);
        }
    };

    const handleUploadPhoto = async () => {
        if (!photoFile) return;
        setUploadingPhoto(true);
        setError(null);
        try {
            await uploadBandMemberPhoto(savedMember.id, photoFile);
            setPhotoFile(null);
            await refreshMember();
        } catch (err) {
            console.error('Error uploading photo:', err);
            setError(err.message || 'Failed to upload photo');
        } finally {
            setUploadingPhoto(false);
        }
    };

    const addTenureRow = () => setTenureRows(prev => [...prev, { start_date: '', end_date: '', isCurrent: false }]);
    const removeTenureRow = (index) => setTenureRows(prev => prev.filter((_, i) => i !== index));
    const updateTenureRow = (index, field, value) => setTenureRows(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));

    const handleSaveTenures = async () => {
        setSavingTenures(true);
        setError(null);
        try {
            for (const row of tenureRows) {
                if (!row.start_date) throw new Error('Every tenure period needs a start date');
            }
            const tenures = tenureRows.map(row => ({ start_date: row.start_date, end_date: row.isCurrent ? null : (row.end_date || null) }));
            await replaceBandMemberTenures(savedMember.id, tenures);
            await refreshMember();
        } catch (err) {
            console.error('Error saving tenures:', err);
            setError(err.message || 'Failed to save tenure periods');
        } finally {
            setSavingTenures(false);
        }
    };

    const openAddGear = () => setGearForm({ ...blankGearForm });
    const openEditGear = (gear) => setGearForm({
        editingGearId: gear.id,
        category: gear.category,
        make: gear.make || '',
        model: gear.model || '',
        year: gear.year || '',
        notes: gear.notes || '',
        start_date: gear.start_date || '',
        end_date: gear.end_date || '',
        isCurrent: !gear.end_date,
        photoFile: null,
    });
    const closeGearForm = () => setGearForm(null);

    const handleSaveGear = async () => {
        setSavingGear(true);
        setError(null);
        try {
            const payload = {
                category: gearForm.category,
                make: gearForm.make,
                model: gearForm.model,
                year: gearForm.year,
                notes: gearForm.notes,
                start_date: gearForm.start_date,
                end_date: gearForm.isCurrent ? '' : gearForm.end_date,
                photoFile: gearForm.photoFile,
            };
            if (gearForm.editingGearId) {
                await updateGearItem(gearForm.editingGearId, payload);
            } else {
                await createGearItem(savedMember.id, payload);
            }
            setGearForm(null);
            await refreshMember();
        } catch (err) {
            console.error('Error saving gear item:', err);
            setError(err.message || 'Failed to save gear item');
        } finally {
            setSavingGear(false);
        }
    };

    const handleDeleteGear = async (gearId) => {
        if (!confirm('Delete this gear item?')) return;
        setError(null);
        try {
            await deleteGearItem(gearId);
            await refreshMember();
        } catch (err) {
            console.error('Error deleting gear item:', err);
            setError(err.message || 'Failed to delete gear item');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <PHeading size="2xl" tag="h1">{savedMember ? 'Edit Band Member' : 'Add New Band Member'}</PHeading>
                <PButtonPure icon="close" onClick={onClose}>Close</PButtonPure>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-6">
                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>
                        Name <span style={{ color: 'var(--p-color-error)' }}>*</span>
                    </label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange}
                        required placeholder="e.g., Chuck Bartels" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Bio</label>
                    <textarea name="bio" value={formData.bio} onChange={handleChange} rows={3}
                        placeholder="Optional short bio" className={inputClass} />
                </div>

                <div>
                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Roles / Instruments</label>
                    {roles.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2">
                            {roles.map(role => (
                                <span key={role} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                                    {role}
                                    <button type="button" onClick={() => removeRole(role)} style={{ color: 'var(--p-color-error)' }}>×</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="flex gap-2">
                        <input type="text" value={newRole} onChange={e => setNewRole(e.target.value)}
                            list="role-suggestions" placeholder="e.g., Keyboards" className={inputClass} style={{ maxWidth: '240px' }}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddRole(); } }} />
                        <datalist id="role-suggestions">
                            {ROLE_SUGGESTIONS.map(r => <option key={r} value={r} />)}
                        </datalist>
                        <PButton type="button" variant="secondary" onClick={handleAddRole}>Add</PButton>
                    </div>
                    <PText size="x-small" color="contrast-medium">A member can have more than one — e.g. Keyboards + Saxophone.</PText>
                </div>

                <div className="flex gap-3 pt-4 border-t border-white/10">
                    <PButton type="submit" loading={saving}>
                        {savedMember ? 'Update Band Member' : 'Create Band Member'}
                    </PButton>
                    <PButton type="button" variant="secondary" disabled={saving} onClick={onClose}>
                        {savedMember ? 'Done' : 'Cancel'}
                    </PButton>
                </div>
            </form>

            {savedMember && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
                    <PHeading size="lg" tag="h2">Photo</PHeading>
                    <div className="flex items-center gap-4">
                        {savedMember.photo_url ? (
                            <img src={savedMember.photo_url} alt={savedMember.name} className="w-20 h-20 rounded-full object-cover" />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-white/10" />
                        )}
                        <div className="space-y-2">
                            <input type="file" accept="image/*" onChange={e => setPhotoFile(e.target.files[0] || null)}
                                className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer" />
                            <PButton type="button" variant="secondary" loading={uploadingPhoto} disabled={!photoFile} onClick={handleUploadPhoto}>
                                {savedMember.photo_url ? 'Replace Photo' : 'Upload Photo'}
                            </PButton>
                        </div>
                    </div>
                </div>
            )}

            {savedMember && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
                    <div>
                        <PHeading size="lg" tag="h2">Tenure Periods</PHeading>
                        <PText size="small" color="contrast-medium">
                            When this member was (or has been) in the band. Leave the end date blank for the period they're currently in.
                        </PText>
                    </div>

                    <div className="space-y-2">
                        {tenureRows.map((row, index) => (
                            <div key={index} className="flex flex-wrap items-end gap-2 rounded-lg border border-white/10 bg-white/5 p-3">
                                <div>
                                    <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Start</label>
                                    <input type="date" value={row.start_date} onChange={e => updateTenureRow(index, 'start_date', e.target.value)}
                                        className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>End</label>
                                    <input type="date" value={row.end_date} disabled={row.isCurrent}
                                        onChange={e => updateTenureRow(index, 'end_date', e.target.value)}
                                        className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs disabled:opacity-40" />
                                </div>
                                <label className="flex items-center gap-1.5 text-xs pb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    <input type="checkbox" checked={row.isCurrent} onChange={e => updateTenureRow(index, 'isCurrent', e.target.checked)} />
                                    Currently active
                                </label>
                                <button type="button" onClick={() => removeTenureRow(index)} className="text-xs pb-1.5" style={{ color: 'var(--p-color-error)' }}>
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-2">
                        <button type="button" className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={addTenureRow}>
                            + Add Tenure Period
                        </button>
                        <PButton type="button" loading={savingTenures} onClick={handleSaveTenures}>Save Tenure Periods</PButton>
                    </div>
                </div>
            )}

            {savedMember && (
                <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 space-y-4">
                    <PHeading size="lg" tag="h2">Gear</PHeading>

                    {(savedMember.gear_items || []).length > 0 && (
                        <div className="space-y-2">
                            {savedMember.gear_items.map(gear => (
                                <div key={gear.id} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {gear.photo_url ? (
                                            <img src={gear.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-lg bg-white/10 shrink-0" />
                                        )}
                                        <div className="min-w-0">
                                            <PText size="small" weight="semi-bold" ellipsis>
                                                {[gear.year, gear.make, gear.model].filter(Boolean).join(' ') || CATEGORY_LABELS[gear.category]}
                                            </PText>
                                            <PText size="x-small" color="contrast-medium">
                                                {CATEGORY_LABELS[gear.category]}{gear.end_date ? ` · retired ${gear.end_date}` : ' · currently in use'}
                                            </PText>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <button type="button" onClick={() => openEditGear(gear)} className="text-xs" style={{ color: 'var(--p-color-info)' }}>Edit</button>
                                        <button type="button" onClick={() => handleDeleteGear(gear.id)} className="text-xs" style={{ color: 'var(--p-color-error)' }}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {gearForm ? (
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                            <PHeading size="sm" tag="h3">{gearForm.editingGearId ? 'Edit Gear Item' : 'Add Gear Item'}</PHeading>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Category</label>
                                    <select value={gearForm.category} onChange={e => setGearForm(prev => ({ ...prev, category: e.target.value }))} className={inputClass}>
                                        {CATEGORY_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Year</label>
                                    <input type="number" value={gearForm.year} onChange={e => setGearForm(prev => ({ ...prev, year: e.target.value }))}
                                        placeholder="e.g., 1959" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Make</label>
                                    <input type="text" value={gearForm.make} onChange={e => setGearForm(prev => ({ ...prev, make: e.target.value }))}
                                        placeholder="e.g., Gibson" className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Model</label>
                                    <input type="text" value={gearForm.model} onChange={e => setGearForm(prev => ({ ...prev, model: e.target.value }))}
                                        placeholder="e.g., Les Paul" className={inputClass} />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Additional Notes</label>
                                <textarea value={gearForm.notes} onChange={e => setGearForm(prev => ({ ...prev, notes: e.target.value }))} rows={2} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass} style={{ color: 'var(--p-color-contrast-medium)' }}>Photo</label>
                                <input type="file" accept="image/*" onChange={e => setGearForm(prev => ({ ...prev, photoFile: e.target.files[0] || null }))}
                                    className="text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white/10 file:text-white hover:file:bg-white/20 file:cursor-pointer" />
                            </div>
                            <div className="flex flex-wrap items-end gap-3">
                                <div>
                                    <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>Start Date</label>
                                    <input type="date" value={gearForm.start_date} onChange={e => setGearForm(prev => ({ ...prev, start_date: e.target.value }))}
                                        className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs" />
                                </div>
                                <div>
                                    <label className="block text-[10px] mb-1" style={{ color: 'var(--p-color-contrast-low)' }}>End Date</label>
                                    <input type="date" value={gearForm.end_date} disabled={gearForm.isCurrent}
                                        onChange={e => setGearForm(prev => ({ ...prev, end_date: e.target.value }))}
                                        className="rounded-lg border border-white/10 bg-white/5 py-1.5 px-2 text-xs disabled:opacity-40" />
                                </div>
                                <label className="flex items-center gap-1.5 text-xs pb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                    <input type="checkbox" checked={gearForm.isCurrent} onChange={e => setGearForm(prev => ({ ...prev, isCurrent: e.target.checked }))} />
                                    Currently in use
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <PButton type="button" loading={savingGear} onClick={handleSaveGear}>Save Gear Item</PButton>
                                <PButton type="button" variant="secondary" disabled={savingGear} onClick={closeGearForm}>Cancel</PButton>
                            </div>
                        </div>
                    ) : (
                        <button type="button" className={btnSecondary} style={{ color: 'var(--p-color-contrast-medium)' }} onClick={openAddGear}>
                            + Add Gear Item
                        </button>
                    )}
                </div>
            )}

            {savedMember && isAdmin && (
                <div className="rounded-2xl border p-6 space-y-4" style={{ borderColor: 'var(--p-color-error)' }}>
                    <PHeading size="lg" tag="h2" style={{ color: 'var(--p-color-error)' }}>Danger Zone</PHeading>
                    <PText size="small" color="contrast-medium">
                        Deleting this band member also deletes all of their gear items and photos.
                    </PText>

                    {!showDeleteConfirm ? (
                        <PButton variant="secondary" disabled={saving}
                            onClick={() => setShowDeleteConfirm(true)}
                            style={{ '--p-button-secondary-color': 'var(--p-color-error)', '--p-button-secondary-border-color': 'var(--p-color-error)' }}>
                            Delete Band Member
                        </PButton>
                    ) : (
                        <div className="space-y-3">
                            <PText weight="semi-bold" style={{ color: 'var(--p-color-error)' }}>
                                Are you sure? This action cannot be undone.
                            </PText>
                            <div className="flex gap-3">
                                <PButton loading={saving} onClick={handleDelete}
                                    style={{ '--p-button-primary-bg': 'var(--p-color-error)' }}>
                                    {saving ? 'Deleting...' : 'Yes, Delete Band Member'}
                                </PButton>
                                <PButton variant="secondary" disabled={saving} onClick={() => setShowDeleteConfirm(false)}>
                                    Cancel
                                </PButton>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

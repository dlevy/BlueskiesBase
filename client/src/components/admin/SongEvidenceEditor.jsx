import { useState } from 'react';
import { PText, PButtonPure } from '@porsche-design-system/components-react';
import { uploadSongEvidencePhoto } from '../../services/api';

const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-1.5 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";

function newId() {
    return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
}

// Add/remove/edit for a song's performance_evidence list — a mix of plain
// hyperlinks and uploaded photos (with an optional, separately-linkable
// credit caption), each with its own display label. Rendered publicly by
// SongEvidenceLinks.jsx. Photo upload requires an existing song id, so this
// only renders in edit mode (see SongForm.jsx).
export default function SongEvidenceEditor({ songId, evidence, onChange }) {
    const [uploadingId, setUploadingId] = useState(null);
    const [error, setError] = useState(null);

    const addLink = () => onChange([...(evidence || []), { id: newId(), type: 'link', label: '', url: '' }]);
    const addPhotoRow = () => onChange([...(evidence || []), { id: newId(), type: 'photo', label: '', photo_url: '', caption: '', caption_url: '' }]);
    const removeRow = (id) => onChange(evidence.filter(item => item.id !== id));
    const updateRow = (id, field, value) => onChange(evidence.map(item => item.id === id ? { ...item, [field]: value } : item));

    const handlePhotoFile = async (id, file) => {
        if (!file) return;
        setError(null);
        setUploadingId(id);
        try {
            const { photo_url } = await uploadSongEvidencePhoto(songId, file);
            updateRow(id, 'photo_url', photo_url);
        } catch (err) {
            console.error('Error uploading evidence photo:', err);
            setError(err.message || 'Failed to upload photo');
        } finally {
            setUploadingId(null);
        }
    };

    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>
                Proof Links <span style={{ color: 'var(--p-color-contrast-low)' }}>(public, shown below this song)</span>
            </label>

            {error && <PText size="x-small" style={{ color: 'var(--p-color-error)' }} className="block mb-1.5">{error}</PText>}

            <div className="space-y-2.5">
                {(evidence || []).map(item => (
                    <div key={item.id} className="rounded-lg border border-white/10 bg-white/5 p-2.5 space-y-2">
                        <div className="flex gap-2 items-center">
                            <PText size="x-small" color="contrast-low" className="uppercase tracking-wide shrink-0 w-12">
                                {item.type === 'photo' ? 'Photo' : 'Link'}
                            </PText>
                            <input type="text" value={item.label} onChange={e => updateRow(item.id, 'label', e.target.value)}
                                placeholder="Label (e.g., Paper setlist, 2012)" className={inputClass} />
                            <PButtonPure type="button" size="small" icon="close" onClick={() => removeRow(item.id)}>Remove</PButtonPure>
                        </div>

                        {item.type === 'link' ? (
                            <input type="url" value={item.url} onChange={e => updateRow(item.id, 'url', e.target.value)}
                                placeholder="https://…" className={inputClass} />
                        ) : (
                            <>
                                {item.photo_url ? (
                                    <div className="flex items-center gap-2">
                                        <img src={item.photo_url} alt="" className="w-12 h-12 object-cover rounded" />
                                        <PButtonPure type="button" size="small" onClick={() => document.getElementById(`evidence-file-${item.id}`).click()}>
                                            Replace Photo
                                        </PButtonPure>
                                    </div>
                                ) : (
                                    <PButtonPure type="button" size="small" loading={uploadingId === item.id}
                                        onClick={() => document.getElementById(`evidence-file-${item.id}`).click()}>
                                        {uploadingId === item.id ? 'Uploading…' : 'Choose Photo'}
                                    </PButtonPure>
                                )}
                                <input id={`evidence-file-${item.id}`} type="file" accept="image/*" className="hidden"
                                    onChange={e => handlePhotoFile(item.id, e.target.files?.[0])} />
                                <input type="text" value={item.caption} onChange={e => updateRow(item.id, 'caption', e.target.value)}
                                    placeholder="Caption (optional, e.g., Photo: @someuser)" className={inputClass} />
                                <input type="url" value={item.caption_url} onChange={e => updateRow(item.id, 'caption_url', e.target.value)}
                                    placeholder="Caption link (optional — makes the caption a credit hyperlink)" className={inputClass} />
                            </>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex gap-3 mt-2">
                <PButtonPure type="button" size="small" icon="plus" onClick={addLink}>Add Link</PButtonPure>
                <PButtonPure type="button" size="small" icon="plus" onClick={addPhotoRow}>Add Photo</PButtonPure>
            </div>
        </div>
    );
}

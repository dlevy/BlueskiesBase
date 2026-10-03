const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 py-1.5 px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500/40 focus:border-transparent placeholder:text-gray-500";
const btnSecondary = "inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-xs font-medium border border-white/15 hover:border-white/25 hover:bg-white/5 transition-all";

// Add/remove editor for an arbitrary {text, url} link list — shared by the
// band member form and the gear form, same shape as site_settings.footer_links.
export default function LinksEditor({ links, onChange, label = 'Links' }) {
    const addRow = () => onChange([...(links || []), { text: '', url: '' }]);
    const removeRow = (index) => onChange(links.filter((_, i) => i !== index));
    const updateRow = (index, field, value) => onChange(links.map((l, i) => i === index ? { ...l, [field]: value } : l));

    return (
        <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--p-color-contrast-medium)' }}>{label}</label>
            <div className="space-y-2">
                {(links || []).map((link, index) => (
                    <div key={index} className="flex gap-2">
                        <input type="text" value={link.text} onChange={e => updateRow(index, 'text', e.target.value)}
                            placeholder="e.g., Instagram" className={inputClass} style={{ maxWidth: '160px' }} />
                        <input type="url" value={link.url} onChange={e => updateRow(index, 'url', e.target.value)}
                            placeholder="https://…" className={inputClass} />
                        <button type="button" onClick={() => removeRow(index)} className="text-xs shrink-0" style={{ color: 'var(--p-color-error)' }}>
                            Remove
                        </button>
                    </div>
                ))}
            </div>
            <button type="button" onClick={addRow} className={`${btnSecondary} mt-2`} style={{ color: 'var(--p-color-contrast-medium)' }}>
                + Add Link
            </button>
        </div>
    );
}

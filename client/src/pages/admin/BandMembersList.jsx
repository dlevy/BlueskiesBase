import { useState, useEffect } from 'react';
import { PHeading, PText, PButton, PButtonPure, PInlineNotification, PSpinner } from '@porsche-design-system/components-react';
import { getBandMembers, updateBandMember } from '../../services/api';
import BandMemberForm from './BandMemberForm';

export default function BandMembersList() {
    const [members, setMembers] = useState([]);
    const [error, setError] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [reordering, setReordering] = useState(false);
    // Only the very first load shows the full-page spinner — a reorder
    // refetch shouldn't flash the whole list away.
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => { fetchMembers(); }, []);

    const fetchMembers = async () => {
        try {
            const data = await getBandMembers();
            setMembers((data.members || []).sort((a, b) => a.sort_order - b.sort_order));
            setError(null);
        } catch (err) {
            console.error('Error fetching band members:', err);
            setError('Failed to load band members');
        } finally {
            setInitialLoading(false);
        }
    };

    const handleEdit = (member) => { setEditingMember(member); setShowForm(true); };
    const handleNew = () => { setEditingMember(null); setShowForm(true); };
    const handleFormClose = () => { setShowForm(false); setEditingMember(null); fetchMembers(); };

    const move = async (member, direction) => {
        const index = members.findIndex(m => m.id === member.id);
        const swapIndex = index + direction;
        if (swapIndex < 0 || swapIndex >= members.length) return;
        const neighbor = members[swapIndex];

        setReordering(true);
        setError(null);
        try {
            await Promise.all([
                updateBandMember(member.id, { sort_order: neighbor.sort_order }),
                updateBandMember(neighbor.id, { sort_order: member.sort_order }),
            ]);
            await fetchMembers();
        } catch (err) {
            console.error('Error reordering band members:', err);
            setError(err.message || 'Failed to reorder band members');
        } finally {
            setReordering(false);
        }
    };

    if (initialLoading) return <div className="flex justify-center items-center py-12"><PSpinner size="medium" /></div>;
    if (error && members.length === 0) return <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />;
    if (showForm) return <BandMemberForm member={editingMember} onClose={handleFormClose} />;

    const isCurrent = (member) => (member.band_member_tenures || []).some(t => !t.end_date);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <PHeading size="2xl" tag="h1">Band Members</PHeading>
                    <PText size="small" color="contrast-medium">
                        Manage the band's lineup and the gear each member uses
                    </PText>
                </div>
                <PButton onClick={handleNew}>+ Add Band Member</PButton>
            </div>

            {error && (
                <PInlineNotification heading="Error" description={error} state="error" dismissButton={false} />
            )}

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-4">
                <div className="text-3xl font-bold" style={{ color: 'var(--p-color-info)' }}>{members.length}</div>
                <PText size="small" color="contrast-medium">Total Band Members</PText>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: 'var(--p-color-surface)' }}>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="border-b border-white/10" style={{ background: 'var(--p-color-canvas)' }}>
                            <tr>
                                {['Order', 'Name', 'Roles', 'Status', 'Gear', 'Actions'].map((h, i) => (
                                    <th key={h}
                                        className={`px-4 py-3 text-xs font-medium uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}
                                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {members.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center">
                                        <PText color="contrast-medium">No band members found. Click "Add Band Member" to create one.</PText>
                                    </td>
                                </tr>
                            ) : (
                                members.map((member, index) => (
                                    <tr key={member.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button type="button" disabled={reordering || index === 0} onClick={() => move(member, -1)}
                                                    className="text-xs px-1.5 disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>↑</button>
                                                <button type="button" disabled={reordering || index === members.length - 1} onClick={() => move(member, 1)}
                                                    className="text-xs px-1.5 disabled:opacity-30" style={{ color: 'var(--p-color-contrast-medium)' }}>↓</button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                {member.photo_url ? (
                                                    <img src={member.photo_url} alt={member.name} className="w-8 h-8 rounded-full object-cover shrink-0" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full shrink-0 bg-white/10" />
                                                )}
                                                <PText size="small" weight="semi-bold">{member.name}</PText>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <PText size="small" color="contrast-medium">{(member.roles || []).join(', ') || '—'}</PText>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span
                                                className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                                                style={isCurrent(member)
                                                    ? { background: 'color-mix(in srgb, var(--p-color-success) 12%, transparent)', color: 'var(--p-color-success)' }
                                                    : { background: 'rgba(255,255,255,0.08)', color: 'var(--p-color-contrast-medium)' }}
                                            >
                                                {isCurrent(member) ? 'Current' : 'Past'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <PText size="small" color="contrast-medium">{(member.gear_items || []).length}</PText>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <PButtonPure size="x-small" onClick={() => handleEdit(member)}>Edit</PButtonPure>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

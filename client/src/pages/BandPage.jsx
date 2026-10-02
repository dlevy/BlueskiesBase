import { useState, useEffect } from 'react';
import { PSpinner, PText, PHeading } from '@porsche-design-system/components-react';
import { getBandMembers } from '../services/api';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

const CATEGORY_LABELS = {
    guitar: 'Guitar', bass: 'Bass', amp: 'Amp', pedal: 'Pedal',
    drums: 'Drums', keys: 'Keys', vocals_mic: 'Vocals/Mic', other: 'Other',
};

function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function formatTenures(tenures) {
    if (!tenures || tenures.length === 0) return null;
    return [...tenures]
        .sort((a, b) => a.start_year - b.start_year)
        .map(t => `${t.start_year}–${t.end_year || 'Present'}`)
        .join(', ');
}

function GearRow({ gear }) {
    const title = [gear.year, gear.make, gear.model].filter(Boolean).join(' ') || CATEGORY_LABELS[gear.category];
    return (
        <div className="flex items-center gap-3 py-2">
            {gear.photo_url ? (
                <img src={gear.photo_url} alt={title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
                <div className="w-12 h-12 rounded-lg bg-white/5 shrink-0" />
            )}
            <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <PText size="small" weight="semi-bold">{title}</PText>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--p-color-contrast-medium)' }}>
                        {CATEGORY_LABELS[gear.category] || gear.category}
                    </span>
                    {!gear.end_date && (
                        <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                            style={{ background: 'color-mix(in srgb, var(--p-color-success) 12%, transparent)', color: 'var(--p-color-success)' }}>
                            Currently using
                        </span>
                    )}
                </div>
                {gear.notes && <PText size="xs" color="contrast-medium">{gear.notes}</PText>}
                {gear.end_date && (
                    <PText size="xs" color="contrast-medium">Retired {formatDate(gear.end_date)}</PText>
                )}
            </div>
        </div>
    );
}

function MemberCard({ member, isCurrent }) {
    const [expanded, setExpanded] = useState(false);
    const gear = member.gear_items || [];
    const tenureText = formatTenures(member.band_member_tenures);

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] overflow-hidden">
            <button type="button" onClick={() => setExpanded(e => !e)} className="w-full flex items-center gap-4 p-4 text-left">
                {member.photo_url ? (
                    <img src={member.photo_url} alt={member.name} className="w-16 h-16 rounded-full object-cover shrink-0" />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-white/5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                    <PHeading size="md" tag="h3">{member.name}</PHeading>
                    {member.roles?.length > 0 && (
                        <PText size="small" color="contrast-medium">{member.roles.join(', ')}</PText>
                    )}
                    {tenureText && (
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{tenureText}</PText>
                    )}
                </div>
                {gear.length > 0 && (
                    <svg className={`w-4 h-4 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                        style={{ color: 'var(--p-color-contrast-medium)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                )}
            </button>

            {expanded && (
                <div className="px-4 pb-4 border-t border-white/5">
                    {member.bio && <PText size="small" color="contrast-medium" className="pt-3">{member.bio}</PText>}
                    {gear.length > 0 ? (
                        <div className="pt-1 divide-y divide-white/5">
                            {gear.map(g => <GearRow key={g.id} gear={g} />)}
                        </div>
                    ) : (
                        <PText size="small" color="contrast-medium" className="pt-3">No gear listed yet.</PText>
                    )}
                </div>
            )}
        </div>
    );
}

export default function BandPage() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        getBandMembers()
            .then(data => { if (!cancelled) setMembers(data.members || []); })
            .catch(err => {
                console.error('[BandPage] Error loading band members:', err);
                if (!cancelled) setError('Failed to load band members');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const isCurrent = (member) => (member.band_member_tenures || []).some(t => !t.end_year);
    const current = members.filter(isCurrent);
    const past = members.filter(m => !isCurrent(m));

    return (
        <div className="px-4 py-4 md:py-6 max-w-4xl mx-auto">
            <SEO
                title="Band"
                description="The members of Sturgill Simpson & Johnny Blue Skies' band, past and present, and the gear each one uses."
            />

            <MainNavTabs />

            <div className="mb-6">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Band
                </h1>
                <PText size="small" color="contrast-medium">
                    The lineup, and the gear each member uses on stage.
                </PText>
            </div>

            {loading && (
                <div className="flex justify-center py-16">
                    <PSpinner size="medium" aria={{ 'aria-label': 'Loading band members' }} />
                </div>
            )}

            {!loading && error && (
                <PText color="notification-error" align="center" className="py-16">{error}</PText>
            )}

            {!loading && !error && members.length === 0 && (
                <PText color="contrast-medium" align="center" className="py-16">No band members listed yet.</PText>
            )}

            {!loading && !error && current.length > 0 && (
                <div className="space-y-3 mb-8">
                    <PHeading size="lg" tag="h2">Current Members</PHeading>
                    {current.map(m => <MemberCard key={m.id} member={m} isCurrent />)}
                </div>
            )}

            {!loading && !error && past.length > 0 && (
                <div className="space-y-3">
                    <PHeading size="lg" tag="h2">Past Members</PHeading>
                    {past.map(m => <MemberCard key={m.id} member={m} />)}
                </div>
            )}
        </div>
    );
}

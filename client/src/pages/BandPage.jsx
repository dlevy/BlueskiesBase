import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PSpinner, PText, PHeading, PInlineNotification } from '@porsche-design-system/components-react';
import { getBandMembers } from '../services/api';
import { slugify } from '../utils/showSlug';
import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';
import GearIcon from '../components/GearIcon';
import LinkPills from '../components/LinkPills';
import Lightbox from 'yet-another-react-lightbox';
import 'yet-another-react-lightbox/styles.css';

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

// Builds this member's lightbox slide list (their own photo first, then each
// gear photo that has one) once, so a photo click can open the lightbox at
// the right index regardless of how many gear items lack photos.
function buildSlides(member, gear) {
    const slides = [];
    if (member.photo_url) slides.push({ src: member.photo_url, alt: member.name, title: member.name, kind: 'member' });
    gear.forEach(g => {
        if (g.photo_url) {
            const title = [g.year, g.make, g.model].filter(Boolean).join(' ') || CATEGORY_LABELS[g.category];
            slides.push({ src: g.photo_url, alt: title, title, kind: 'gear', gearId: g.id });
        }
    });
    return slides;
}

function GearRow({ gear, onPhotoClick }) {
    const title = [gear.year, gear.make, gear.model].filter(Boolean).join(' ') || CATEGORY_LABELS[gear.category];
    return (
        <div className="flex items-center gap-3 py-2">
            {gear.photo_url ? (
                <img
                    src={gear.photo_url}
                    alt={title}
                    onClick={(e) => { e.stopPropagation(); onPhotoClick(gear.id); }}
                    className="w-12 h-12 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                />
            ) : (
                <div className="w-12 h-12 rounded-lg bg-white/5 shrink-0 flex items-center justify-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                    <GearIcon category={gear.category} size={22} />
                </div>
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
                {gear.links?.length > 0 && <div className="mt-1"><LinkPills links={gear.links} /></div>}
            </div>
        </div>
    );
}

function MemberCard({ member }) {
    const [expanded, setExpanded] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const gear = member.gear_items || [];
    const tenureText = formatTenures(member.band_member_tenures);
    const slides = buildSlides(member, gear);

    const openLightboxFor = (kind, gearId) => {
        const index = slides.findIndex(s => s.kind === kind && (kind === 'member' || s.gearId === gearId));
        if (index === -1) return;
        setLightboxIndex(index);
        setLightboxOpen(true);
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-[#1a1e26] overflow-hidden">
            <div className="w-full flex items-center gap-4 p-4">
                {member.photo_url ? (
                    <img
                        src={member.photo_url}
                        alt={member.name}
                        onClick={() => openLightboxFor('member')}
                        className="w-16 h-16 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    />
                ) : (
                    <div className="w-16 h-16 rounded-full bg-white/5 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                    <Link to={`/band/${slugify(member.name)}`} className="hover:opacity-80 transition-opacity">
                        <PHeading size="md" tag="h3">{member.name}</PHeading>
                    </Link>
                    {member.roles?.length > 0 && (
                        <PText size="small" color="contrast-medium">{member.roles.join(', ')}</PText>
                    )}
                    {tenureText && (
                        <PText size="xs" style={{ color: 'var(--p-color-contrast-low)' }}>{tenureText}</PText>
                    )}
                </div>
                {gear.length > 0 && (
                    <button type="button" onClick={() => setExpanded(e => !e)} className="shrink-0 p-1" aria-label={expanded ? 'Collapse gear' : 'Expand gear'}>
                        <svg className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                            style={{ color: 'var(--p-color-contrast-medium)' }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                )}
            </div>

            {expanded && (
                <div className="px-4 pb-4 border-t border-white/5">
                    {member.bio && <PText size="small" color="contrast-medium" className="pt-3">{member.bio}</PText>}
                    {gear.length > 0 ? (
                        <div className="pt-1 divide-y divide-white/5">
                            {gear.map(g => <GearRow key={g.id} gear={g} onPhotoClick={(gearId) => openLightboxFor('gear', gearId)} />)}
                        </div>
                    ) : (
                        <PText size="small" color="contrast-medium" className="pt-3">No gear listed yet.</PText>
                    )}
                </div>
            )}

            <Lightbox open={lightboxOpen} close={() => setLightboxOpen(false)} slides={slides} index={lightboxIndex} />
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

            <div className="mb-6">
                <PInlineNotification
                    heading="Under construction"
                    description="This section of the archive is still being built out. If you're a gear geek who'd like to help curate and expand it, we'd love your help!"
                    state="warning"
                    dismissButton={false}
                />
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

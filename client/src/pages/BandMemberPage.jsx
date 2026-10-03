import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { PSpinner, PText, PHeading, PButtonPure } from '@porsche-design-system/components-react';
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

function GearCard({ gear, onPhotoClick }) {
    const title = [gear.year, gear.make, gear.model].filter(Boolean).join(' ') || CATEGORY_LABELS[gear.category];
    return (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex gap-4">
            {gear.photo_url ? (
                <img
                    src={gear.photo_url}
                    alt={title}
                    onClick={() => onPhotoClick(gear.id)}
                    className="w-20 h-20 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                />
            ) : (
                <div className="w-20 h-20 rounded-lg bg-white/5 shrink-0 flex items-center justify-center" style={{ color: 'var(--p-color-contrast-low)' }}>
                    <GearIcon category={gear.category} size={32} />
                </div>
            )}
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <PText weight="semi-bold">{title}</PText>
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
                {gear.notes && <PText size="small" color="contrast-medium">{gear.notes}</PText>}
                {gear.end_date && (
                    <PText size="xs" color="contrast-medium">Retired {formatDate(gear.end_date)}</PText>
                )}
                <LinkPills links={gear.links} />
            </div>
        </div>
    );
}

export default function BandMemberPage() {
    const { slug } = useParams();
    const [members, setMembers] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    useEffect(() => {
        let cancelled = false;
        getBandMembers()
            .then(data => { if (!cancelled) setMembers(data.members || []); })
            .catch(err => {
                console.error('[BandMemberPage] Error loading band members:', err);
                if (!cancelled) setError('Failed to load this band member');
            })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return (
            <div className="px-4 py-4 md:py-6 max-w-3xl mx-auto">
                <MainNavTabs />
                <div className="flex justify-center items-center py-16"><PSpinner size="medium" /></div>
            </div>
        );
    }

    const member = members?.find(m => slugify(m.name) === slug);

    if (error || !member) {
        return (
            <div className="px-4 py-4 md:py-6 max-w-3xl mx-auto">
                <MainNavTabs />
                <div className="py-12 max-w-lg mx-auto text-center space-y-4">
                    <PHeading size="xl" tag="h1">{error ? 'Something went wrong' : 'Band member not found'}</PHeading>
                    {!error && <PText color="contrast-medium">There's no band member at this URL.</PText>}
                    <Link to="/band"><PButtonPure icon="arrow-left">Back to Band</PButtonPure></Link>
                </div>
            </div>
        );
    }

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
        <div className="px-4 py-4 md:py-6 max-w-3xl mx-auto space-y-6">
            <SEO
                title={member.name}
                description={`${member.name}'s role and gear in Sturgill Simpson & Johnny Blue Skies' band.`}
            />

            <MainNavTabs />

            <Link to="/band" className="inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity" style={{ color: 'var(--p-color-contrast-medium)' }}>
                ← Back to Band
            </Link>

            <div className="rounded-2xl border border-white/10 bg-[#1a1e26] p-6 md:p-8">
                <div className="flex items-start gap-5">
                    {member.photo_url ? (
                        <img
                            src={member.photo_url}
                            alt={member.name}
                            onClick={() => openLightboxFor('member')}
                            className="w-24 h-24 rounded-full object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                        />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-white/5 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                        <PHeading size="xl" tag="h1">{member.name}</PHeading>
                        {member.roles?.length > 0 && (
                            <PText color="contrast-medium">{member.roles.join(', ')}</PText>
                        )}
                        {tenureText && (
                            <PText size="small" style={{ color: 'var(--p-color-contrast-low)' }}>{tenureText}</PText>
                        )}
                        <div className="pt-1"><LinkPills links={member.links} /></div>
                    </div>
                </div>

                {member.bio && (
                    <PText color="contrast-medium" className="mt-4 block" style={{ whiteSpace: 'pre-wrap' }}>
                        {member.bio}
                    </PText>
                )}
            </div>

            <div className="space-y-3">
                <PHeading size="lg" tag="h2">Gear</PHeading>
                {gear.length > 0 ? (
                    <div className="space-y-3">
                        {gear.map(g => <GearCard key={g.id} gear={g} onPhotoClick={(gearId) => openLightboxFor('gear', gearId)} />)}
                    </div>
                ) : (
                    <PText color="contrast-medium">No gear listed yet.</PText>
                )}
            </div>

            <Lightbox open={lightboxOpen} close={() => setLightboxOpen(false)} slides={slides} index={lightboxIndex} />
        </div>
    );
}

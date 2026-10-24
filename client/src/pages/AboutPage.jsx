import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

function Section({ title, children }) {
    return (
        <div className="mb-8">
            <h2 className="font-display font-bold text-lg mb-2" style={{ color: 'var(--p-color-primary)' }}>
                {title}
            </h2>
            {children}
        </div>
    );
}

export default function AboutPage() {
    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
            <SEO
                title="About SkySets.org"
                description="Who runs SkySets.org, where the data comes from, and how to get in touch."
            />

            <MainNavTabs />

            <div className="mb-8">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    About SkySets.org
                </h1>
            </div>

            <p className="text-sm mb-8" style={{ color: 'var(--p-color-contrast-medium)' }}>
                SkySets.org is a fan-built archive of every Sturgill Simpson and Johnny Blue Skies &amp; The Dark Clouds setlist we can find,
                from 2005 to tonight. It started because the music deserved a proper home for its live history, and because fans kept asking
                "did he play it last night?"
            </p>

            <p className="text-sm mb-8" style={{ color: 'var(--p-color-contrast-medium)' }}>
                The site is run by Daniel Levy, a fan in the Pacific Northwest, and curated with help from Sarah Tabor, with setlists, photos
                and fixes contributed by members across the country. It takes its cue from crowesbase, the Black Crowes archive, and owes a
                lot to Where the Sweet Melody Falls.
            </p>

            <Section title="What we stand for">
                <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    <li>Free, no ads. No subscriptions, no paywalls, no data sales.</li>
                    <li>Fans over flippers. Poster sales are cost plus shipping. No commission, no scalping.</li>
                    <li>Accuracy. Setlists are checked against fan reports and recordings, and corrections are welcome.</li>
                </ul>
            </Section>

            <Section title="Not affiliated">
                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    SkySets.org is an independent fan project. It isn't affiliated with, endorsed by, or sponsored by Sturgill Simpson,
                    Johnny Blue Skies &amp; The Dark Clouds, their label, management or promoters. Band names, song titles and poster art
                    belong to their owners and are used here for reference and fan discussion. For official news, tickets and merch, visit{' '}
                    <a href="https://sturgillsimpson.com" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--p-color-info)' }}>
                        sturgillsimpson.com
                    </a>.
                </p>
            </Section>

            <Section title="Contact">
                <ul className="space-y-1 text-sm mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    <li>
                        Email: <a href="mailto:admin@skysets.org" className="underline" style={{ color: 'var(--p-color-info)' }}>admin@skysets.org</a>
                    </li>
                    <li>
                        Instagram: <a href="https://instagram.com/jbssetlists" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--p-color-info)' }}>@jbssetlists</a>
                    </li>
                </ul>
                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    For setlist fixes, comment on the show or submit a correction from its page. Use email for photo or poster takedown
                    requests, account questions and anything else. We usually reply within a few days.
                </p>
            </Section>
        </div>
    );
}

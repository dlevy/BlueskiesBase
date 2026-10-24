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

function P({ children }) {
    return (
        <p className="text-sm mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>
            {children}
        </p>
    );
}

function Bullets({ items }) {
    return (
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm mb-3" style={{ color: 'var(--p-color-contrast-medium)' }}>
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    );
}

export default function TermsPage() {
    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
            <SEO
                title="Terms of Use & Community Guidelines"
                description="The ground rules for using SkySets.org, posting photos, and trading posters with other fans."
            />

            <MainNavTabs />

            <div className="mb-8">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Terms of Use &amp; Community Guidelines
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--p-color-contrast-low)' }}>
                    Effective October 24, 2026
                </p>
            </div>

            <P>
                By using SkySets.org you agree to these terms. They're short on purpose. If you don't agree, please don't use the site.
            </P>

            <Section title="The site">
                <P>
                    SkySets.org is a free fan archive provided as-is. We work hard on accuracy, but setlists, dates and stats can contain
                    mistakes, and the site may change or go offline without notice. SkySets.org is not affiliated with Sturgill Simpson,
                    Johnny Blue Skies &amp; The Dark Clouds, or their representatives.
                </P>
            </Section>

            <Section title="Your account">
                <Bullets items={[
                    'Use a real email address and keep your password private.',
                    "You're responsible for what happens under your account.",
                    'One person per account. You must be at least 18 years old.',
                ]} />
            </Section>

            <Section title="What you post">
                <P>
                    You keep ownership of the photos and content you submit. By posting, you give SkySets.org permission to display it on
                    the site and its social accounts (such as @jbssetlists), with credit where possible. You can remove it or ask us to at
                    any time.
                </P>
                <P>Only post things you have the right to share:</P>
                <Bullets items={[
                    'Photos you took yourself, or photos credited to the person who took them.',
                    'Accurate setlist information and corrections.',
                    'No harassment, hate speech, spam, or explicit content.',
                    "No posting other people's personal information.",
                    'No pirated recordings or links to them.',
                ]} />
                <P>We may remove content or accounts that break these rules.</P>
            </Section>

            <Section title="Poster trading rules">
                <P>The poster board exists to get posters to fans at fair prices.</P>
                <Bullets items={[
                    'Cost plus shipping, period. If you sell, ask no more than what you paid plus actual shipping. Trades can be any swap both sides agree to.',
                    'Only list posters you own and can ship.',
                    'Describe condition honestly, including foil vs. regular, edition numbers, and any dings, creases or tears.',
                    'Follow through. If you agree to a deal, complete it promptly and share tracking.',
                    'No scalping. Listings priced above cost, bulk flipping, or steering buyers to off-site markups will be removed, and repeat offenders lose their account.',
                ]} />
                <P>
                    Trades happen directly between members. SkySets.org doesn't process payments, hold posters, verify authenticity, or
                    guarantee any transaction, and isn't responsible for losses or disputes. Use payment methods with buyer protection and
                    report problems to admin@skysets.org.
                </P>
            </Section>

            <Section title="Artwork and trademarks">
                <P>
                    Poster artwork belongs to the artists credited on each poster. Photos belong to the photographers credited in their
                    captions; some are shared from fans' public posts rather than uploaded here. Band names, logos, album art and song titles
                    belong to their owners and appear here for reference and fan discussion. If you own content shown on SkySets.org and want
                    it credited differently or removed, email admin@skysets.org and we'll respond promptly.
                </P>
            </Section>

            <Section title="Limitation of liability">
                <P>
                    To the fullest extent allowed by law, SkySets.org and its operator aren't liable for any indirect or consequential
                    damages from using the site, including member-to-member trades.
                </P>
            </Section>

            <Section title="Changes">
                <P>
                    We may update these terms. Continuing to use the site after changes means you accept them. The effective date above
                    shows the latest version.
                </P>
            </Section>

            <Section title="Contact">
                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    <a href="mailto:admin@skysets.org" className="underline" style={{ color: 'var(--p-color-info)' }}>admin@skysets.org</a>
                </p>
            </Section>
        </div>
    );
}

import { Link } from 'react-router-dom';
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

function Steps({ items }) {
    return (
        <ol className="list-decimal list-outside pl-5 space-y-1.5 text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ol>
    );
}

function Bullets({ items }) {
    return (
        <ul className="list-disc list-outside pl-5 space-y-1.5 text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    );
}

export default function HowToUsePage() {
    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
            <SEO
                title="How to Use SkySets.org"
                description="A quick guide to finding Sturgill Simpson and Johnny Blue Skies setlists, tracking the shows you've attended, and trading posters on SkySets.org."
            />

            <MainNavTabs />

            <div className="mb-8">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    How to Use SkySets
                </h1>
                <p className="text-sm mt-2" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    SkySets.org works without an account. Sign up only if you want to track your own shows, build a poster collection, or trade posters.
                </p>
            </div>

            <Section title="Find a setlist">
                <Steps items={[
                    <>On the home page, Tonight's Show and Most Recent Shows sit at the top.</>,
                    <>To go further back, pick a year under Browse by Year (2005 to today).</>,
                    <>Use Advanced Filters to narrow your search.</>,
                    <>Click any show to see the full setlist, poster and photos for that night.</>,
                ]} />
            </Section>

            <Section title="Explore stats">
                <Bullets items={[
                    <>The Stats tab shows song counts and history across every show in the archive.</>,
                    <>Tour Stats covers the current tour: shows played, live debuts, tour debuts, most-played songs and the rarest songs so far.</>,
                    <>Upcoming Shows lists confirmed dates, including official afterparties.</>,
                ]} />
            </Section>

            <Section title="Track the shows you've been to">
                <Steps items={[
                    <>Click Sign Up and create an account with your email and a password.</>,
                    <>Open a show you attended and mark it as attended.</>,
                    <>Open My Shows to see your personal stats: shows seen, songs heard and songs you're still chasing.</>,
                ]} />
            </Section>

            <Section title="Set up your profile">
                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Add a display name and, if you like, links to your Instagram, Facebook, Reddit or YouTube. Other members can find you in
                    the Members directory, and your links may appear on the public <Link to="/links" className="underline" style={{ color: 'var(--p-color-info)' }}>Links</Link> page.
                    Leave them blank if you'd rather stay low-key.
                </p>
            </Section>

            <Section title="Browse and trade posters">
                <Steps items={[
                    <>Open <Link to="/posters" className="underline" style={{ color: 'var(--p-color-info)' }}>Posters</Link> to see the full show-poster archive with artist credits and foil variants.</>,
                    <>Check Most Wanted for posters other fans are hunting.</>,
                    <>Available for Sale/Trade lists posters members are offering from their own collections.</>,
                    <>Click I'm Interested on a listing to reach the owner. You work out the details directly with them.</>,
                    <>To list your own poster, log in and mark it as available for sale or trade. Selling price is cost plus shipping, nothing more.</>,
                ]} />
            </Section>

            <Section title="Photos">
                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    The <Link to="/photos" className="underline" style={{ color: 'var(--p-color-info)' }}>Photos</Link> tab collects fan photos by show, newest first. Members can add their own photos to show pages, and we also feature
                    photos fans share online, credited to the photographer in the caption. Want a photo removed or re-credited? Email{' '}
                    <a href="mailto:admin@skysets.org" className="underline" style={{ color: 'var(--p-color-info)' }}>admin@skysets.org</a>.
                </p>
            </Section>

            <Section title="Get setlists in your feed">
                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Follow <a href="https://instagram.com/jbssetlists" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--p-color-info)' }}>@jbssetlists</a> on Instagram for setlists as shows happen.
                </p>
            </Section>

            <Section title="Something wrong?">
                <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                    Spotted a wrong song, missing show or broken page? Leave a comment on the show or submit a correction from its page. You can
                    also DM @jbssetlists on Instagram or email{' '}
                    <a href="mailto:admin@skysets.org" className="underline" style={{ color: 'var(--p-color-info)' }}>admin@skysets.org</a>. We read everything.
                </p>
            </Section>
        </div>
    );
}

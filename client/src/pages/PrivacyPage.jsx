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

function P({ children, className = '' }) {
    return (
        <p className={`text-sm mb-3 ${className}`} style={{ color: 'var(--p-color-contrast-medium)' }}>
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

const PROVIDERS = [
    { name: 'Vercel', does: 'Hosts the website', receives: 'Technical request data such as IP address and pages requested, to deliver pages and block abuse' },
    { name: 'Supabase', does: 'Database and account sign-in', receives: 'Account details and everything you add to the site' },
    { name: 'Cloudflare Web Analytics', does: 'Privacy-friendly traffic counts', receives: 'Pages viewed and basic visit data, without cookies' },
    { name: 'Google Fonts', does: "Serves the site's fonts", receives: 'Your IP address and browser details when fonts load' },
    { name: 'Porsche Design System CDN', does: 'Serves interface icons and components', receives: 'Your IP address and browser details when they load' },
];

export default function PrivacyPage() {
    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
            <SEO
                title="Privacy Policy"
                description="What SkySets.org collects, why, who it's shared with, and how to delete your data."
            />

            <MainNavTabs />

            <div className="mb-8">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Privacy Policy
                </h1>
                <p className="text-xs mt-1" style={{ color: 'var(--p-color-contrast-low)' }}>
                    Effective October 24, 2026
                </p>
            </div>

            <P>
                SkySets.org ("we," "us") is a free, non-commercial fan site. We collect as little as we can, we don't show ads, and we never
                sell your information. This policy explains what we collect and what you can do about it. Questions go to{' '}
                <a href="mailto:admin@skysets.org" className="underline" style={{ color: 'var(--p-color-info)' }}>admin@skysets.org</a>.
            </P>

            <Section title="What we collect">
                <P>
                    <strong style={{ color: 'var(--p-color-primary)' }}>If you just browse:</strong> We don't ask you for anything. Our
                    built-in analytics count visits and page views to help us improve the site; they don't record details such as your IP
                    address, browser type or device. Like any website, our hosting provider (Vercel) handles basic technical request data to
                    deliver pages and block abuse.
                </P>
                <P>
                    <strong style={{ color: 'var(--p-color-primary)' }}>If you create an account:</strong>
                </P>
                <Bullets items={[
                    'Your email address, which we can see and use to contact you about your account. Your password is stored in hashed form by our authentication provider, so it’s never readable by us.',
                    'Shows you mark as attended, and the stats built from them.',
                    'Anything you add to your profile, such as a display name and social media links.',
                    'Posters you add to your collection, list for sale or trade, or mark as wanted, and "I’m Interested" requests you send.',
                    'Photos you submit, and any captions or show details with them.',
                ]} />
                <P>
                    When you're signed in, we also note which site features you use, so we can see what's working and what to improve.
                </P>
                <P>
                    <strong style={{ color: 'var(--p-color-primary)' }}>If you contact us:</strong> Your email address and whatever you
                    include in the message.
                </P>
                <P>
                    <strong style={{ color: 'var(--p-color-primary)' }}>Photos from elsewhere:</strong> Some photos on SkySets.org are
                    shared publicly by fans online rather than uploaded here. We credit the photographer in the caption and remove any photo
                    on request.
                </P>
            </Section>

            <Section title="How we use it">
                <Bullets items={[
                    'To run your account and show you your stats.',
                    'To display your profile, listings and photos to other members as described below.',
                    'To connect members about poster trades.',
                    'To understand which pages are used so we can improve the site.',
                    'To keep the site secure and stop spam or abuse.',
                    'To answer your messages.',
                ]} />
                <P>We don't use your information for advertising, and we don't sell or rent it to anyone.</P>
            </Section>

            <Section title="What other people can see">
                <Bullets items={[
                    'Public: setlists, stats, posters, photos, and poster listings. Social links you add to your profile may appear on the public Links page.',
                    'Logged-in members: the Members directory and member profiles.',
                    'Private: your email address, password and attended-show list, unless you choose to share them.',
                ]} />
            </Section>

            <Section title="Cookies and local storage">
                <P>
                    We don't use advertising or tracking cookies. We use your browser's local storage to keep you signed in and to count
                    visits (a random session ID). Cloudflare Web Analytics measures traffic without cookies and without tracking you across
                    other sites.
                </P>
            </Section>

            <Section title="Services we rely on">
                <P>We share data with a few providers only so the site can work:</P>
                <div className="overflow-x-auto mb-3 rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                        <thead style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <tr>
                                {['Provider', 'What it does', 'What it receives'].map(h => (
                                    <th key={h} className="text-left px-3 py-2 font-semibold" style={{ color: 'var(--p-color-primary)' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {PROVIDERS.map(p => (
                                <tr key={p.name}>
                                    <td className="px-3 py-2 align-top font-medium whitespace-nowrap" style={{ color: 'var(--p-color-primary)' }}>{p.name}</td>
                                    <td className="px-3 py-2 align-top" style={{ color: 'var(--p-color-contrast-medium)' }}>{p.does}</td>
                                    <td className="px-3 py-2 align-top" style={{ color: 'var(--p-color-contrast-medium)' }}>{p.receives}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <P>
                    Each provider handles data under its own privacy policy. We may also disclose information if required by law or to
                    protect the site and its members.
                </P>
            </Section>

            <Section title="How long we keep it">
                <P>
                    Account data stays until you delete your account. If you sign up but never activate your account, we usually delete it
                    after a week or two. After deletion we remove your personal information within 30 days, though copies in routine backups
                    may take longer to expire. Analytics data is kept in aggregate.
                </P>
            </Section>

            <Section title="Your choices and rights">
                <Bullets items={[
                    'Edit or remove profile details, listings and photos at any time.',
                    'Ask us to correct or delete your information by emailing admin@skysets.org. To delete your account, email us from the address on the account.',
                    'Ask us to remove a photo that shows you or that you took, even if you didn’t post it.',
                ]} />
                <P>Have another question or request about your data? Email us and we'll do our best to help.</P>
            </Section>

            <Section title="Children">
                <P>
                    SkySets.org isn't directed at anyone under 18, and we don't knowingly collect information from them. If you believe
                    someone under 18 has created an account, email us and we'll delete it.
                </P>
            </Section>

            <Section title="Changes">
                <P>If we change this policy, we'll update the effective date above.</P>
            </Section>

            <Section title="Contact">
                <P className="mb-0">
                    <a href="mailto:admin@skysets.org" className="underline" style={{ color: 'var(--p-color-info)' }}>admin@skysets.org</a>
                </P>
            </Section>
        </div>
    );
}

import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

// Single source of truth for both the visible Q&A list and the FAQPage
// JSON-LD below — Google's guidance is explicit that the structured data's
// answer text must match what's on the page, and generating both from one
// array is the only way that can't silently drift out of sync.
const FAQ_SECTIONS = [
    {
        heading: 'Going to a show',
        items: [
            {
                q: 'What should I know before going to a Sturgill Simpson or Johnny Blue Skies concert?',
                a: "If you're on time, you're late. Expect three-plus hours on your feet. Posters are limited and sell out fast, so if you want one, head straight to the merch stand when you get in. Have your tickets ready before you reach the door, expect a security check, and look up the venue's bag policy ahead of time, including whether it allows poster tubes.",
            },
            {
                q: 'What time do Johnny Blue Skies shows start?',
                a: "Your best bet is to arrive when doors open. The band usually takes the stage right on time, so don't count on a late start.",
            },
            {
                q: 'Should I get a seat or a GA pit ticket?',
                a: "It's up to you. The GA pit gets you a lot closer to the stage. In larger venues, seats can pick up some echo: at one Seattle show we heard it from our seats, while friends in the GA pit said the sound was great.",
            },
            {
                q: 'How do I get a Sturgill Simpson or Johnny Blue Skies show poster?',
                a: "Go straight to the merch stand as soon as you're inside. A show usually has 75 or fewer foil posters and 300 to 500 regular ones, and they go quickly. If you miss out, members sometimes list posters for trade here at cost plus shipping.",
            },
            {
                q: 'What are the merch lines like?',
                a: 'Long. Some items sell out, so go early.',
            },
            {
                q: "Can I drink if I'm in the GA pit?",
                a: "You can, but it's a pain. Every refill or bathroom run means fighting the crowd to get back to your spot, over and over. Skip it and you won't have to leave at all. Plus the drinks are way overpriced. Trust us.",
            },
            {
                q: 'Do people stand, sit, or dance at the shows?',
                a: 'You do you, but expect to be standing, and expect the people in front of you to be standing and dancing.',
            },
            {
                q: 'Are the shows loud?',
                a: 'Yes.',
            },
            {
                q: 'How do I stay comfortable during a long show?',
                a: "Drink water, and wear shoes you can stand in for three-plus hours. Pace yourself: you can always take more, but you can never take less. Don't be that person.",
            },
        ],
    },
    {
        heading: 'The music and the show',
        items: [
            {
                q: 'What is the format of a Johnny Blue Skies concert?',
                a: 'Usually one long set, with little to no pause between songs.',
            },
            {
                q: 'Is Johnny Blue Skies a jam band?',
                a: "That's up for interpretation, but it's a band that jams. Songs get extended and flow from one into the next, the same song can sound very different from night to night, and surprise riffs and teases come up often, so keep your ears open.",
            },
            {
                q: 'What is the stage production like?',
                a: 'Pretty lean: good lighting and some banners.',
            },
            {
                q: "What are Sturgill Simpson's politics?",
                a: "Listen to the lyrics. It's been pretty obvious for some time, and even more so since the release of Mutiny After Midnight.",
            },
            {
                q: 'Where can I find live recordings of Sturgill Simpson and Johnny Blue Skies?',
                a: "Soundboard recordings are available with a nugs.net subscription, and there are lots of fan videos on YouTube. Many of those videos are embedded right in the setlists here on SkySets.",
            },
        ],
    },
    {
        heading: 'About the site',
        items: [
            {
                q: 'What is SkySets.org?',
                a: 'SkySets.org is a fan-run archive of concert setlists for Sturgill Simpson and Johnny Blue Skies & The Dark Clouds, going back to 2005. It also tracks tour stats, show posters, fan photos, and a poster-trading board for fans.',
            },
            {
                q: 'Is SkySets.org affiliated with Sturgill Simpson or his management?',
                a: "No. SkySets.org is an independent fan project. It isn't run, endorsed, or sponsored by Sturgill Simpson, Johnny Blue Skies, the band, their label, or their management. For official news and tickets, visit sturgillsimpson.com.",
            },
            {
                q: 'Who runs it?',
                a: 'SkySets.org is run by Daniel Levy, a longtime fan in the Pacific Northwest, and curated with help from Sarah Tabor and members who share setlists, photos and corrections. It was inspired by crowesbase.',
            },
            {
                q: 'Is it free?',
                a: 'Yes. Browsing is free and so is an account. There are no ads, subscriptions, or premium tiers.',
            },
        ],
    },
    {
        heading: 'Setlists and stats',
        items: [
            {
                q: 'Where do the setlists come from?',
                a: 'Setlists are compiled from fans at the show, recordings, social media posts, and long-running fan archives like Where the Sweet Melody Falls. Recent shows are usually posted the same night.',
            },
            {
                q: 'How fast are new shows added?',
                a: "During a tour, setlists are usually posted the night of the show and refined over the next day as fans confirm songs and order.",
            },
            {
                q: 'I found a mistake in a setlist. How do I report it?',
                a: "Open the show's page and leave a comment or submit a correction right there. If you can't, DM @jbssetlists on Instagram or email admin@skysets.org with the show date, city and what's wrong. Corrections are reviewed and usually fixed within a few days.",
            },
            {
                q: 'What do "live debut" and "tour debut" mean?',
                a: 'A live debut is the first time a song has ever been played live. A tour debut is the first time a song is played on the current tour.',
            },
            {
                q: 'How is "rarest" calculated?',
                a: 'Rarest songs are the ones played at the fewest shows so far on the current tour.',
            },
        ],
    },
    {
        heading: 'Accounts and My Shows',
        items: [
            {
                q: 'Do I need an account?',
                a: "No. Setlists, stats, posters and photos are open to everyone. An account lets you mark the shows you've attended, see your personal stats, browse the member directory, build your own poster collection, and list posters for trade.",
            },
            {
                q: "How do I track the shows I've been to?",
                a: 'Sign up, open any show, and mark it as attended. Your My Shows tab then shows how many shows you’ve seen, the songs you’ve heard, and more.',
            },
            {
                q: 'Can other people see my shows?',
                a: 'Members who are logged in can see the member directory and profiles. Anything you add to your profile, like a display name or social links, is visible to other members, and social links may appear on the public Links page.',
            },
            {
                q: 'How do I delete my account?',
                a: "Email admin@skysets.org from the address on your account, and we'll delete your account and its data within 30 days.",
            },
        ],
    },
    {
        heading: 'Posters',
        items: [
            {
                q: 'How does poster trading work?',
                a: "Members can list posters from their own collection as available for sale or trade. Other members click \"I'm Interested\" to start a conversation. SkySets.org doesn't handle money, shipping, or the posters themselves.",
            },
            {
                q: 'Why is selling limited to cost plus shipping?',
                a: 'SkySets.org is built to keep posters with fans, not flippers. If you sell, ask what you paid plus shipping. Listings priced for profit get removed.',
            },
            {
                q: 'Does SkySets.org take a cut?',
                a: 'No. No subscription, no commission, no fees.',
            },
            {
                q: 'Is SkySets.org responsible if a trade goes wrong?',
                a: 'No. Trades happen directly between members. Use a payment method with buyer protection, share tracking numbers, and report bad actors to admin@skysets.org.',
            },
        ],
    },
    {
        heading: 'Photos and privacy',
        items: [
            {
                q: 'Can I submit photos?',
                a: 'Yes. Logged-in members can add photos to show pages. Only share photos you took yourself, or credit the person who took it.',
            },
            {
                q: "I took a photo that's on SkySets. Why is it here?",
                a: "Besides member uploads, we feature photos fans share publicly online so each show has a visual record. We always try to credit the photographer in the caption. If you'd like a different credit, or want the photo removed, email admin@skysets.org and we'll take care of it right away.",
            },
            {
                q: 'A photo of me is on the site and I want it removed.',
                a: "Email admin@skysets.org with the show and photo, and it'll be taken down.",
            },
            {
                q: 'Does SkySets.org sell my data?',
                a: 'No. There are no ads and no data sales. See the Privacy Policy for the details.',
            },
        ],
    },
];

const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_SECTIONS.flatMap(section =>
        section.items.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
        }))
    ),
};

export default function FaqPage() {
    return (
        <div className="px-4 pt-2 pb-4 md:pt-3 md:pb-6 max-w-4xl mx-auto">
            <SEO
                title="FAQ"
                description="Concert tips for Sturgill Simpson and Johnny Blue Skies shows (start times, posters, seats vs. GA pit) plus answers about SkySets.org, the fan-run setlist archive."
                jsonLd={faqJsonLd}
            />

            <MainNavTabs />

            <div className="mb-8">
                <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--p-color-primary)' }}>
                    Frequently Asked Questions
                </h1>
            </div>

            <div className="space-y-10">
                {FAQ_SECTIONS.map(section => (
                    <div key={section.heading}>
                        <h2 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--p-color-primary)' }}>
                            {section.heading}
                        </h2>
                        <div className="space-y-5">
                            {section.items.map(({ q, a }) => (
                                <div key={q}>
                                    <p className="font-semibold text-sm mb-1" style={{ color: 'var(--p-color-primary)' }}>
                                        {q}
                                    </p>
                                    <p className="text-sm" style={{ color: 'var(--p-color-contrast-medium)' }}>
                                        {a}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

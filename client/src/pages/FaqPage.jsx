import MainNavTabs from '../components/MainNavTabs';
import SEO from '../components/SEO';

// FAQ content lives in server/data/faq.json so the server can prerender the
// same questions for crawlers that don't run JS (see server/utils/faqMeta.js).
// Google requires FAQPage structured data to match the visible text exactly,
// so the page, its JSON-LD, and the prerender must all come from that file.
import faq from '../../../server/data/faq.json';

const FAQ_SECTIONS = faq.sections;

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
                title={faq.title}
                description={faq.description}
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

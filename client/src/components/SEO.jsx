import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'blueskiesbase';
const DEFAULT_DESCRIPTION = 'The complete Sturgill Simpson and Johnny Blue Skies setlist database. Search 400+ concerts from 2012 to present, including the Why Not? and Who the F**k Is Johnny Blue Skies? tours.';

export default function SEO({ title, description, canonical, jsonLd }) {
    const fullTitle = title
        ? `${title} | ${SITE_NAME}`
        : `${SITE_NAME} – Sturgill Simpson & Johnny Blue Skies Setlists`;
    const desc = description || DEFAULT_DESCRIPTION;

    return (
        <Helmet>
            <title>{fullTitle}</title>
            <meta name="description" content={desc} />
            {canonical && <link rel="canonical" href={canonical} />}

            <meta property="og:title" content={fullTitle} />
            <meta property="og:description" content={desc} />
            <meta property="og:type" content="website" />
            <meta property="og:site_name" content={SITE_NAME} />

            <meta name="twitter:card" content="summary" />
            <meta name="twitter:title" content={fullTitle} />
            <meta name="twitter:description" content={desc} />

            {jsonLd && (
                <script type="application/ld+json">
                    {JSON.stringify(jsonLd)}
                </script>
            )}
        </Helmet>
    );
}

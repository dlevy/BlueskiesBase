import { useNavigate } from 'react-router-dom';
import { PHeading, PText, PButtonPure } from '@porsche-design-system/components-react';
import SEO from '../components/SEO';
import TourStatsModule from '../components/TourStatsModule';

export default function TourStatsPage() {
    const navigate = useNavigate();

    return (
        <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
            <SEO
                title="Tour Stats"
                description="Every song played on tour, ranked by how many shows it's been played at."
            />

            <PButtonPure icon="arrow-left" onClick={() => navigate('/')}>
                Back to Search
            </PButtonPure>

            <div>
                <PHeading size="2xl" tag="h1">Tour Stats</PHeading>
                <PText color="contrast-medium">Every song played on tour, ranked by number of shows played at</PText>
            </div>

            <TourStatsModule />
        </div>
    );
}

import { supabase } from '../services/supabase';

// city/state/country are now separate real columns on venues (state_country
// still exists too, but only as a frozen legacy value buildShowPath()
// slugifies into show URLs — see server/routes/venues.js). This joins
// whichever of the three a venue actually has into one display string.
export function formatVenueLocation(venue) {
    if (!venue) return '';
    return [venue.city, venue.state, venue.country].filter(Boolean).join(', ');
}

// Distinct State/Country filter options. With no `tourName`, every distinct
// value across all venues (paginated the same way fetchTourList pages
// through shows, since venues can exceed PostgREST's 1000-row default too) —
// used for the sitewide Search filters. With a `tourName`, scoped to just
// that tour's shows instead, so e.g. Tour Stats' State/Country dropdowns only
// list places that tour actually played.
export async function fetchGeographyOptions(tourName) {
    let states, countries;
    if (tourName) {
        let rows = [];
        for (let rangeStart = 0; ;) {
            const { data: page, error } = await supabase
                .from('shows')
                .select('venues ( state, country )')
                .eq('tour_name', tourName)
                .order('id')
                .range(rangeStart, rangeStart + 999);
            if (error || !page?.length) break;
            rows = rows.concat(page);
            if (page.length < 1000) break;
            rangeStart += 1000;
        }
        states = rows.map(r => r.venues?.state).filter(Boolean);
        countries = rows.map(r => r.venues?.country).filter(Boolean);
    } else {
        let rows = [];
        for (let rangeStart = 0; ;) {
            const { data: page, error } = await supabase
                .from('venues')
                .select('state, country')
                .order('id')
                .range(rangeStart, rangeStart + 999);
            if (error || !page?.length) break;
            rows = rows.concat(page);
            if (page.length < 1000) break;
            rangeStart += 1000;
        }
        states = rows.map(r => r.state).filter(Boolean);
        countries = rows.map(r => r.country).filter(Boolean);
    }

    return {
        states: [...new Set(states)].sort((a, b) => a.localeCompare(b)),
        countries: [...new Set(countries)].sort((a, b) => a.localeCompare(b)),
    };
}

import { supabase } from '../services/supabase';

// venues.state_country is one free-text column (no separate state/country
// columns) and admins type it inconsistently — the same real place can be
// "MI", "Michigan", or "Michigan, United States" depending on who entered
// it. getCountry/getStateName below normalize all of those forms.
const US_STATE_CODES = new Set([
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC','PR',
]);
const US_STATE_NAMES = new Set([
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
    'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
    'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
    'District of Columbia',
]);
const UK_REGIONS = new Set(['UK','England','Scotland','Wales','Northern Ireland']);

export function getCountry(state_country) {
    if (!state_country) return null;
    const sc = state_country.trim();
    if (sc.endsWith(', United States'))  return 'USA';
    if (US_STATE_CODES.has(sc))          return 'USA';
    if (US_STATE_NAMES.has(sc))          return 'USA';
    if (sc === 'UK' || UK_REGIONS.has(sc) || sc.endsWith(', United Kingdom')) return 'UK';
    if (sc === 'Ireland' || sc.endsWith(', Ireland')) return 'Ireland';
    if (sc === 'Canada' || sc.includes(', Canada'))   return 'Canada';
    // "Oslo, Norway" / "Hamburg, Germany" / "Ontario, Canada" etc.
    if (sc.includes(',')) return sc.split(',').pop().trim();
    return sc;
}

const US_STATE_CODE_TO_NAME = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
    CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
    HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
    MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
    MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
    NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
    OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
    SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
    DC: 'District of Columbia', PR: 'Puerto Rico',
};

// Full US state name (e.g. "Michigan") for any recognized raw form — a bare
// code ("MI"), a bare full name ("Michigan"), or "Name, United States". Takes
// everything before the LAST comma so "Washington, D.C., United States" is
// handled as a single case below rather than splitting on its embedded comma.
// Returns null for anything not a recognized US state (including non-US
// countries/regions — those are only ever surfaced via getCountry above).
export function getStateName(state_country) {
    if (!state_country) return null;
    const sc = state_country.trim();
    const lastComma = sc.lastIndexOf(',');
    const statePart = lastComma === -1 ? sc : sc.slice(0, lastComma).trim();
    if (US_STATE_CODE_TO_NAME[statePart]) return US_STATE_CODE_TO_NAME[statePart];
    if (US_STATE_NAMES.has(statePart)) return statePart;
    if (statePart === 'Washington, D.C.') return 'District of Columbia';
    return null;
}

// Distinct State/Country filter options. With no `tourName`, derived from
// every venue's state_country value (paginated the same way fetchTourList
// pages through shows, since venues can exceed PostgREST's 1000-row default
// too) — used for the sitewide Search filters. With a `tourName`, scoped to
// just that tour's shows instead, so e.g. Tour Stats' State/Country dropdowns
// only list places that tour actually played.
export async function fetchGeographyOptions(tourName) {
    let raw;
    if (tourName) {
        let rows = [];
        for (let rangeStart = 0; ;) {
            const { data: page, error } = await supabase
                .from('shows')
                .select('venues ( state_country )')
                .eq('tour_name', tourName)
                .order('id')
                .range(rangeStart, rangeStart + 999);
            if (error || !page?.length) break;
            rows = rows.concat(page);
            if (page.length < 1000) break;
            rangeStart += 1000;
        }
        raw = rows.map(r => r.venues?.state_country).filter(Boolean);
    } else {
        let rows = [];
        for (let rangeStart = 0; ;) {
            const { data: page, error } = await supabase
                .from('venues')
                .select('state_country')
                .order('id')
                .range(rangeStart, rangeStart + 999);
            if (error || !page?.length) break;
            rows = rows.concat(page);
            if (page.length < 1000) break;
            rangeStart += 1000;
        }
        raw = rows.map(r => r.state_country).filter(Boolean);
    }

    const states = [...new Set(raw.map(getStateName).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const countries = [...new Set(raw.map(getCountry).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return { states, countries };
}

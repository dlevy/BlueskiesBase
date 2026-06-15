export function slugify(str) {
    return (str || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// Returns the full path: /show/{artist}/{date}/{city-state}
export function buildShowPath(show) {
    const artist = slugify(show.artist_name || '');
    const date = show.show_date;
    const locationParts = [];
    if (show.venues?.city) locationParts.push(slugify(show.venues.city));
    if (show.venues?.state_country) locationParts.push(slugify(show.venues.state_country));
    return `/show/${artist}/${date}/${locationParts.join('-')}`;
}

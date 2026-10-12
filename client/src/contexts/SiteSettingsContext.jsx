import { createContext, useContext } from 'react';

// Exposes the site-wide header title/subtitle PublicLayout (App.jsx) already
// fetches once for the header itself, so other components (e.g.
// ShowMapShare's branding) can reuse it without a second, redundant
// GET /api/settings round-trip.
const SiteSettingsContext = createContext({ headerTitle: '', headerSubtitle: '' });

export function SiteSettingsProvider({ headerTitle, headerSubtitle, children }) {
    return (
        <SiteSettingsContext.Provider value={{ headerTitle, headerSubtitle }}>
            {children}
        </SiteSettingsContext.Provider>
    );
}

export function useSiteSettings() {
    return useContext(SiteSettingsContext);
}

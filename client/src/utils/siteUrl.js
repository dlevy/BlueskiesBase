// The one real address of the site. Canonical tags, og:url and structured
// data always use this rather than window.location.origin — otherwise a
// visit through another host (blueskies-base.vercel.app, a preview deploy)
// would declare *that* host canonical once React loads.
export const SITE_URL = 'https://www.skysets.org';

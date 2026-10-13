const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { computeSongsSeenForShows, computeDebutDetails } = require('../utils/attendance');
const { computeFunStats } = require('../utils/funStats');
const { redactProfile } = require('../utils/privacy');
const { computeSetlistIndex } = require('../utils/setlistIndex');

// "Today" for past-vs-upcoming show classification, from the viewer's own
// browser (query param/body field, computed there via local y/m/d — see
// client/src/utils/today.js) rather than the server's own UTC clock. The
// server has no timezone of its own that's "correct" for every visitor, and
// `new Date().toISOString().slice(0, 10)` (UTC) wrongly starts treating a
// show dated tomorrow as "today or past" once UTC crosses midnight — i.e.
// for the whole evening in any negative-UTC-offset timezone (all of North
// America). Falls back to the server's UTC date only when no caller-supplied
// value is present (e.g. an older cached client, or a non-browser caller).
function resolveTodayStr(candidate) {
    return typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate)
        ? candidate
        : new Date().toISOString().slice(0, 10);
}

const AVATARS_BUCKET = 'avatars';

const uploadAvatarFile = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit, same as photos/posters
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    },
});

/**
 * POST /api/users/check-attendance-batch
 * Check attendance for multiple shows at once
 * Requires authentication
 * Body: { showIds: [1, 2, 3, ...] }
 * Returns: { attendance: { 1: true, 2: false, 3: true, ... } }
 */
router.post('/check-attendance-batch', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { showIds } = req.body;
        if (!showIds || !Array.isArray(showIds) || showIds.length === 0) {
            return res.status(400).json({ error: 'showIds array is required' });
        }

        console.log(`[check-attendance-batch] Checking ${showIds.length} shows for user ${user.id}`);

        // If there are too many show IDs, we need to batch the query
        // PostgreSQL/Supabase has limits on IN clause size
        const BATCH_SIZE = 100;
        let allUserShows = [];

        if (showIds.length > BATCH_SIZE) {
            // Process in batches
            for (let i = 0; i < showIds.length; i += BATCH_SIZE) {
                const batch = showIds.slice(i, i + BATCH_SIZE);
                const { data: batchUserShows, error } = await supabase
                    .from('user_shows')
                    .select('show_id')
                    .eq('user_id', user.id)
                    .in('show_id', batch);

                if (error) {
                    console.error('Error checking attendance batch:', error);
                    return res.status(500).json({ error: 'Failed to check attendance' });
                }

                allUserShows = allUserShows.concat(batchUserShows || []);
            }
        } else {
            // Single query for small batches
            const { data: userShows, error } = await supabase
                .from('user_shows')
                .select('show_id')
                .eq('user_id', user.id)
                .in('show_id', showIds);

            if (error) {
                console.error('Error checking attendance:', error);
                return res.status(500).json({ error: 'Failed to check attendance' });
            }

            allUserShows = userShows || [];
        }

        // Create a map of show_id -> true for attended shows
        const attendanceMap = {};
        showIds.forEach(showId => {
            attendanceMap[showId] = false; // Default to false
        });

        allUserShows.forEach(userShow => {
            attendanceMap[userShow.show_id] = true;
        });

        console.log(`[check-attendance-batch] Found ${allUserShows.length} attended shows out of ${showIds.length}`);
        res.json({ attendance: attendanceMap });
    } catch (error) {
        console.error('Error in check-attendance-batch:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/attended-shows
 * Get all shows the user has marked as attended
 * Requires authentication
 */
router.get('/attended-shows', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Get all shows the user has attended
        const { data: userShows, error } = await supabase
            .from('user_shows')
            .select(`
                id,
                show_id,
                marked_at,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues (
                        name,
                        city,
                        state_country
                    )
                )
            `)
            .eq('user_id', user.id)
            .order('shows(show_date)', { ascending: false });

        if (error) {
            console.error('Error fetching attended shows:', error);
            return res.status(500).json({ error: 'Failed to fetch attended shows' });
        }

        res.json({ shows: userShows || [] });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/users/attended-shows/:showId
 * Mark a show as attended
 * Requires authentication
 */
router.post('/attended-shows/:showId', async (req, res) => {
    try {
        const { showId } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Insert the user_show record
        const { data, error } = await supabase
            .from('user_shows')
            .insert([{ user_id: user.id, show_id: showId }])
            .select()
            .single();

        if (error) {
            // Check if it's a duplicate
            if (error.code === '23505') {
                return res.status(400).json({ error: 'Show already marked as attended' });
            }
            console.error('Error marking show as attended:', error);
            return res.status(500).json({ error: 'Failed to mark show as attended' });
        }

        res.status(201).json(data);

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/users/attended-shows/:showId
 * Unmark a show as attended
 * Requires authentication
 */
router.delete('/attended-shows/:showId', async (req, res) => {
    try {
        const { showId } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Delete the user_show record
        const { error } = await supabase
            .from('user_shows')
            .delete()
            .eq('user_id', user.id)
            .eq('show_id', showId);

        if (error) {
            console.error('Error unmarking show:', error);
            return res.status(500).json({ error: 'Failed to unmark show' });
        }

        res.json({ message: 'Show unmarked successfully' });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/stats
 * Get user statistics (attended shows, songs seen, songs not seen)
 * Requires authentication
 */
router.get('/stats', async (req, res) => {
    try {
        console.log('[Stats] Request received');
        const startTime = Date.now();

        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.log('[Stats] No authorization header');
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');

        console.log('[Stats] Authenticating user...');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            console.log('[Stats] Authentication failed:', authError?.message);
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log(`[Stats] User authenticated: ${user.email}`);

        // Get all attended shows with their setlists
        console.log('[Stats] Fetching attended shows...');
        const { data: attendedShows, error: showsError } = await supabase
            .from('user_shows')
            .select(`
                show_id,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues (
                        id,
                        name,
                        city,
                        state_country
                    )
                )
            `)
            .eq('user_id', user.id);

        if (showsError) {
            console.error('[Stats] Error fetching attended shows:', showsError);
            return res.status(500).json({ error: 'Failed to fetch statistics' });
        }

        console.log(`[Stats] Found ${attendedShows?.length || 0} attended shows`);
        const attendedShowIds = attendedShows.map(us => us.show_id);

        // songsSeen, the shared setlist index, and the full song catalog are
        // independent of each other — fetch/compute them together rather than
        // one after another. The index used to be re-derived here from scratch
        // (a full, uncached setlist_songs scan, same again for "songs not seen"
        // below) on every single request; it's now a shared cache, see
        // utils/setlistIndex.js's own comment for the measured cost this was.
        console.log('[Stats] Fetching songs seen, setlist index, and song catalog...');
        const [songsSeen, index, allSongsResult] = await Promise.all([
            computeSongsSeenForShows(attendedShowIds),
            computeSetlistIndex(),
            supabase.from('songs').select('id, title, is_original, is_sunday_valley, original_artist'),
        ]);

        if (allSongsResult.error) {
            console.error('[Stats] Error fetching songs:', allSongsResult.error);
            return res.status(500).json({ error: 'Failed to fetch statistics' });
        }

        // Every song that's been played at least once, per the shared index.
        const allPlayedSongs = (allSongsResult.data || [])
            .filter(song => index.showIdsBySong.has(song.id))
            .sort((a, b) => a.title.localeCompare(b.title));

        // Calculate songs not seen (played songs that user hasn't seen)
        const seenSongIds = new Set(songsSeen.map(s => s.id));
        const songsNotSeenBasic = allPlayedSongs.filter(song => !seenSongIds.has(song.id));

        // Most recent show for each song not seen — the index already knows
        // which show that was (lastPlayedShowIdBySong), so this only needs one
        // batched fetch of the (usually far fewer than songsNotSeenBasic.length,
        // since many songs share the same most-recently-played show) distinct
        // shows actually needed, not a second full setlist_songs scan.
        let songsNotSeenWithShow = [];

        if (songsNotSeenBasic.length > 0) {
            const neededShowIds = [...new Set(
                songsNotSeenBasic.map(s => index.lastPlayedShowIdBySong.get(s.id)).filter(Boolean)
            )];

            const { data: neededShows, error: neededShowsError } = await supabase
                .from('shows')
                .select('id, show_date, artist_name, venues ( name, city, state_country )')
                .in('id', neededShowIds);

            if (neededShowsError) {
                console.error('[Stats] Error fetching most-recent shows for not-seen songs:', neededShowsError);
            }

            const showById = new Map((neededShows || []).map(s => [s.id, s]));
            songsNotSeenWithShow = songsNotSeenBasic.map(song => {
                const showId = index.lastPlayedShowIdBySong.get(song.id);
                return { ...song, mostRecentShow: (showId && showById.get(showId)) || null };
            });
        }

        // Past shows (full objects, not just ids) — a future show marked "attending"
        // has no setlist yet, so debuts/fun-facts are scoped to shows that already
        // happened, same "only past shows" intent as before.
        const todayStr = resolveTodayStr(req.query.today);
        const pastShows = attendedShows
            .map(us => us.shows)
            .filter(s => s?.show_date && s.show_date <= todayStr);

        const { liveDebuts } = await computeDebutDetails(pastShows, songsSeen);
        const funStats = computeFunStats(pastShows, songsSeen);

        // Who else attended/is attending each of this user's own shows — batched into
        // one query here rather than a per-show-row client fetch (same data shape as
        // GET /shows/:id/attendees, grouped by show_id, with the viewer themselves
        // excluded since they obviously attended their own shows).
        const attendeesByShow = {};
        if (attendedShowIds.length > 0) {
            const { data: attendeeRows, error: attendeesError } = await supabase
                .from('user_shows')
                .select(`
                    show_id,
                    user_id,
                    profiles:user_id ( id, username, display_name, hide_from_directory )
                `)
                .in('show_id', attendedShowIds)
                .neq('user_id', user.id);

            if (attendeesError) {
                console.error('[Stats] Error fetching co-attendees:', attendeesError);
            } else {
                (attendeeRows || []).forEach(row => {
                    if (!row.profiles?.username) return;
                    const p = redactProfile(row.profiles);
                    if (!attendeesByShow[row.show_id]) attendeesByShow[row.show_id] = [];
                    attendeesByShow[row.show_id].push({ id: p.id, username: p.username, displayName: p.display_name || null });
                });
            }
        }

        // Community contribution counts (setlist submissions, photos, posters, comments)
        // — cheap head-only counts, same pattern as GET /community-stats, just scoped to
        // this one user. Powers the "Community" achievement track.
        const [notesResult, submissionsResult, photosResult, postersResult] = await Promise.all([
            supabase.from('user_notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('setlist_submissions').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('user_photos').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
            supabase.from('user_posters').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);
        const contributionCounts = {
            notes: notesResult.count || 0,
            submissions: submissionsResult.count || 0,
            photos: photosResult.count || 0,
            posters: postersResult.count || 0,
        };
        contributionCounts.total = contributionCounts.notes + contributionCounts.submissions + contributionCounts.photos + contributionCounts.posters;

        const endTime = Date.now();
        const duration = endTime - startTime;
        console.log(`[Stats] ✅ Request completed in ${duration}ms`);
        console.log(`[Stats] Shows: ${attendedShows.length}, Songs Seen: ${songsSeen.length}, Songs Not Seen: ${songsNotSeenWithShow.length}`);

        const response = {
            totalShowsAttended: attendedShows.length,
            attendedShows: attendedShows.map(us => us.shows),
            songsSeen: songsSeen,
            songsNotSeen: songsNotSeenWithShow,
            totalSongsSeen: songsSeen.length,
            totalSongsNotSeen: songsNotSeenWithShow.length,
            liveDebutsWitnessed: liveDebuts.length,
            liveDebuts,
            attendeesByShow,
            contributionCounts,
            funStats,
        };

        console.log('[Stats] Sending response...');
        res.json(response);

    } catch (error) {
        console.error('[Stats] ❌ Error:', error);
        console.error('[Stats] Error stack:', error.stack);
        res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /api/users/directory
 * Every registered member, for the /members directory. Requires
 * authentication — any signed-in member can browse, but it's not public to
 * anonymous visitors. Explicitly whitelisted fields only (never email, which
 * lives only in Supabase auth.users, never in profiles) — same shape
 * discipline as GET /shows/:id/attendees.
 */
router.get('/directory', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, location, avatar_url, role, hide_from_directory')
            .order('username', { ascending: true });

        if (error) {
            console.error('[GET /users/directory] Error:', error);
            return res.status(500).json({ error: 'Failed to fetch directory' });
        }

        // Shows-attended count per member, so the client can compute each
        // member's attendance badge (utils/badges.js) the same way
        // GET /profile/:username's totalShowsAttended does — past shows only,
        // not ones they're just marked attending in the future. Paginated
        // since user_shows can exceed PostgREST's 1000-row default as the
        // community grows (same pattern as GET /community-stats).
        const todayStr = resolveTodayStr(req.query.today);
        const attendedCounts = {};
        for (let rangeStart = 0; ;) {
            const { data: page, error: pageError } = await supabase
                .from('user_shows')
                .select('user_id, shows(show_date)')
                .order('id')
                .range(rangeStart, rangeStart + 999);
            if (pageError) {
                console.error('[GET /users/directory] Error fetching attendance:', pageError);
                return res.status(500).json({ error: 'Failed to fetch directory' });
            }
            (page || []).forEach(row => {
                if (!row.user_id || !row.shows?.show_date || row.shows.show_date > todayStr) return;
                attendedCounts[row.user_id] = (attendedCounts[row.user_id] || 0) + 1;
            });
            if (!page || page.length < 1000) break;
            rangeStart += 1000;
        }

        const members = (data || [])
            .filter(p => p.username && !p.hide_from_directory)
            .map(p => ({
                id: p.id,
                username: p.username,
                displayName: p.display_name || null,
                location: p.location || null,
                avatarUrl: p.avatar_url || null,
                role: p.role || 'member',
                showsAttended: attendedCounts[p.id] || 0,
            }));

        res.json({ members });
    } catch (err) {
        console.error('[GET /users/directory] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/mentionable
 * Lightweight username/display-name list for @mention autocomplete in
 * comments. Any signed-in user (comments require being signed in anyway).
 * Deliberately NOT /directory, which does an expensive per-request
 * attendance-count aggregation unneeded here.
 */
router.get('/mentionable', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name')
            .not('username', 'is', null)
            .order('username', { ascending: true });

        if (error) {
            console.error('[GET /users/mentionable] Error:', error);
            return res.status(500).json({ error: 'Failed to fetch users' });
        }

        const users = (data || []).map(p => ({ id: p.id, username: p.username, displayName: p.display_name || null }));
        res.json({ users });
    } catch (err) {
        console.error('[GET /users/mentionable] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/social-links
 * Public, no auth required — every member who has added at least one of
 * Facebook/Reddit/Instagram/YouTube to their profile. Powers the "Member
 * Links" section at the bottom of the public /links page, separate from the
 * admin-managed links table.
 */
router.get('/social-links', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url, facebook_url, reddit_url, instagram_url, youtube_url, hide_from_directory')
            .or('facebook_url.not.is.null,reddit_url.not.is.null,instagram_url.not.is.null,youtube_url.not.is.null')
            .order('username', { ascending: true });

        if (error) {
            console.error('[GET /users/social-links] Error:', error);
            return res.status(500).json({ error: 'Failed to fetch member links' });
        }

        const members = (data || [])
            .filter(p => p.username && !p.hide_from_directory)
            .map(p => ({
                id: p.id,
                username: p.username,
                displayName: p.display_name || null,
                avatarUrl: p.avatar_url || null,
                ...(p.facebook_url && { facebookUrl: p.facebook_url }),
                ...(p.reddit_url && { redditUrl: p.reddit_url }),
                ...(p.instagram_url && { instagramUrl: p.instagram_url }),
                ...(p.youtube_url && { youtubeUrl: p.youtube_url }),
            }));

        res.json({ members });
    } catch (err) {
        console.error('[GET /users/social-links] Error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/profile/:username
 * Public profile — no auth required. Always includes aggregate stats; opt-in
 * identity fields (displayName/location/avatarUrl/facebookUrl/redditUrl/
 * instagramUrl/youtubeUrl/bio) are included only when set; the itemized
 * attendedShows list is included only when the profile has
 * show_attendance_public = true.
 */
router.get('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('username', username)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'Profile not found' });
        }

        const { data: attendedShows, error: showsError } = await supabase
            .from('user_shows')
            .select(`
                show_id,
                shows (
                    id,
                    show_date,
                    artist_name,
                    tour_name,
                    venues ( id, name, city, state_country, latitude, longitude )
                )
            `)
            .eq('user_id', profile.id);

        if (showsError) {
            console.error('[Public Profile] Error fetching attended shows:', showsError);
            return res.status(500).json({ error: 'Failed to fetch profile stats' });
        }

        const todayStr = resolveTodayStr(req.query.today);
        const allAttendedShows = (attendedShows || []).map(us => us.shows).filter(Boolean);
        const pastShows = allAttendedShows.filter(s => s.show_date && s.show_date <= todayStr);
        const upcomingShows = allAttendedShows.filter(s => s.show_date && s.show_date > todayStr);
        const pastShowIds = pastShows.map(s => s.id);

        const songsSeen = await computeSongsSeenForShows(pastShowIds);
        const funStats = computeFunStats(pastShows, songsSeen);
        const { liveDebuts, tourDebuts } = await computeDebutDetails(pastShows, songsSeen);

        // User-picked favorites (not auto-computed) — looked up directly rather than
        // cross-referenced from pastShows so they still resolve correctly even in any
        // edge case where the pick isn't in that particular list.
        let favoriteShow = null;
        if (profile.favorite_show_id) {
            const { data } = await supabase
                .from('shows')
                .select('id, show_date, artist_name, tour_name, venues ( name, city, state_country )')
                .eq('id', profile.favorite_show_id)
                .single();
            favoriteShow = data || null;
        }

        let favoriteVenue = null;
        if (profile.favorite_venue_id) {
            const { data } = await supabase
                .from('venues')
                .select('id, name, city, state_country')
                .eq('id', profile.favorite_venue_id)
                .single();
            favoriteVenue = data || null;
        }

        // Poster collection — public once added, same as favorite show/venue (no
        // separate opt-in toggle; owning a poster isn't personally sensitive the way
        // real name/location/attendance history can be). Foil status comes from the
        // poster itself (user_posters.is_foil), not tracked separately here.
        const { data: collectionRows } = await supabase
            .from('user_poster_collection')
            .select(`
                id,
                for_trade,
                trade_comment,
                edition_type,
                user_posters (
                    id,
                    poster_url,
                    is_foil,
                    shows ( id, show_date, artist_name, tour_name, venues ( name, city, state_country ) )
                )
            `)
            .eq('user_id', profile.id);

        const posterCollection = (collectionRows || [])
            .filter(row => row.user_posters?.shows)
            .map(row => ({
                id: row.id,
                hasFoil: row.user_posters.is_foil,
                posterUrl: row.user_posters.poster_url,
                show: row.user_posters.shows,
                forTrade: row.for_trade,
                tradeComment: row.trade_comment,
                editionType: row.edition_type,
            }))
            .sort((a, b) => b.show.show_date.localeCompare(a.show.show_date));

        // Posters wanted — same public-once-added treatment as the collection above.
        const { data: wantRows } = await supabase
            .from('user_poster_wants')
            .select(`
                id,
                variant,
                shows ( id, show_date, artist_name, tour_name, venues ( name, city, state_country ) )
            `)
            .eq('user_id', profile.id);

        const wantedShowIds = [...new Set((wantRows || []).filter(row => row.shows).map(row => row.shows.id))];

        // A want can only be created for a show that already has an official
        // poster (enforced in POST /api/posters/wants), so this resolves a real
        // image for virtually every entry — picked to match the wanted variant
        // when possible, falling back to any available poster for that show.
        // Legacy wants predating that rule may still have no poster at all.
        const postersByShowId = new Map();
        if (wantedShowIds.length > 0) {
            const { data: linkRows } = await supabase
                .from('poster_show_links')
                .select('show_id, user_posters ( poster_url, is_foil )')
                .in('show_id', wantedShowIds);
            (linkRows || []).forEach(row => {
                if (!row.user_posters) return;
                if (!postersByShowId.has(row.show_id)) postersByShowId.set(row.show_id, []);
                postersByShowId.get(row.show_id).push(row.user_posters);
            });
        }

        const postersWanted = (wantRows || [])
            .filter(row => row.shows)
            .map(row => {
                const candidates = postersByShowId.get(row.shows.id) || [];
                const match = row.variant === 'foil'
                    ? candidates.find(p => p.is_foil)
                    : row.variant === 'regular'
                        ? candidates.find(p => !p.is_foil)
                        : null;
                const poster = match || candidates[0];
                return {
                    id: row.id,
                    variant: row.variant,
                    show: row.shows,
                    posterUrl: poster?.poster_url,
                };
            })
            .sort((a, b) => b.show.show_date.localeCompare(a.show.show_date));

        // Community contribution count — powers the Community achievement track,
        // same cheap head-only-count pattern as the personal stats route, just scoped
        // to this profile's user id instead of the viewer's.
        const [notesResult, submissionsResult, photosResult, postersResult] = await Promise.all([
            supabase.from('user_notes').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
            supabase.from('setlist_submissions').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
            supabase.from('user_photos').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
            supabase.from('user_posters').select('*', { count: 'exact', head: true }).eq('user_id', profile.id),
        ]);
        const contributionCount = (notesResult.count || 0) + (submissionsResult.count || 0) + (photosResult.count || 0) + (postersResult.count || 0);

        const response = {
            username: profile.username,
            role: profile.role || 'member',
            ...(profile.display_name && { displayName: profile.display_name }),
            ...(profile.location && { location: profile.location }),
            ...(profile.avatar_url && { avatarUrl: profile.avatar_url }),
            ...(profile.facebook_url && { facebookUrl: profile.facebook_url }),
            ...(profile.reddit_url && { redditUrl: profile.reddit_url }),
            ...(profile.instagram_url && { instagramUrl: profile.instagram_url }),
            ...(profile.youtube_url && { youtubeUrl: profile.youtube_url }),
            ...(profile.bio && { bio: profile.bio }),

            memberSince: profile.created_at,
            totalShowsAttended: pastShows.length,
            favoriteShow,
            favoriteVenue,
            firstShow: funStats?.firstShow || null,
            uniqueCities: funStats?.uniqueCities || 0,
            liveDebuts,
            tourDebuts,
            contributionCount,
            posterCollection,
            postersWanted,
        };

        if (profile.show_attendance_public) {
            response.attendedShows = pastShows.sort((a, b) => b.show_date.localeCompare(a.show_date));
            response.upcomingShows = upcomingShows.sort((a, b) => a.show_date.localeCompare(b.show_date));
        }

        res.json(response);
    } catch (error) {
        console.error('[Public Profile] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/users/profile
 * Update the logged-in user's own opt-in profile fields. Requires authentication.
 * Body: { displayName, location, facebookUrl, redditUrl, instagramUrl,
 *         youtubeUrl, bio, showAttendancePublic, favoriteShowId, favoriteVenueId }
 * favoriteShowId/favoriteVenueId (when non-null) must reference a show the user has
 * actually attended (in the past) / a venue from one of those shows — validated
 * against user_shows here, not just enforced by the picker UI.
 */
router.put('/profile', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { displayName, location, facebookUrl, redditUrl, instagramUrl, youtubeUrl, bio, showAttendancePublic, favoriteShowId, favoriteVenueId } = req.body;

        const validateUrl = (url, requiredHosts, label) => {
            if (!url) return null;
            const hosts = Array.isArray(requiredHosts) ? requiredHosts : [requiredHosts];
            // Tolerate a protocol-less URL (e.g. "facebook.com/name") rather than
            // rejecting the whole save over it — a very natural thing to type.
            const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;
            let parsed;
            try {
                parsed = new URL(withProtocol);
            } catch {
                throw new Error(`Please enter a valid ${label || hosts[0].split('.')[0]} URL`);
            }
            if (!hosts.some(host => parsed.hostname.toLowerCase().includes(host))) {
                throw new Error(`Please enter a valid ${label || hosts[0].split('.')[0]} URL`);
            }
            return withProtocol;
        };

        const validateLength = (value, max, label) => {
            if (value && value.trim().length > max) {
                throw new Error(`${label} must be ${max} characters or fewer`);
            }
            return value?.trim() || null;
        };

        let updates;
        try {
            updates = {
                display_name: validateLength(displayName, 80, 'Display name'),
                location: validateLength(location, 100, 'Location'),
                bio: validateLength(bio, 500, 'Bio'),
                facebook_url: validateUrl(facebookUrl?.trim(), 'facebook.com'),
                reddit_url: validateUrl(redditUrl?.trim(), 'reddit.com'),
                instagram_url: validateUrl(instagramUrl?.trim(), 'instagram.com'),
                youtube_url: validateUrl(youtubeUrl?.trim(), ['youtube.com', 'youtu.be'], 'YouTube'),
                show_attendance_public: Boolean(showAttendancePublic),
            };
        } catch (validationError) {
            return res.status(400).json({ error: validationError.message });
        }

        // Favorite show/venue must come from the user's own past attended shows.
        if (favoriteShowId !== undefined || favoriteVenueId !== undefined) {
            const todayStr = resolveTodayStr(req.body.today);
            const { data: attended, error: attendedError } = await supabase
                .from('user_shows')
                .select('shows ( id, show_date, venue_id )')
                .eq('user_id', user.id);

            if (attendedError) {
                console.error('[Update Profile] Error fetching attended shows:', attendedError);
                return res.status(500).json({ error: 'Failed to validate favorite show/venue' });
            }

            const pastAttended = (attended || [])
                .map(row => row.shows)
                .filter(s => s?.show_date && s.show_date <= todayStr);
            const validShowIds = new Set(pastAttended.map(s => s.id));
            const validVenueIds = new Set(pastAttended.map(s => s.venue_id).filter(Boolean));

            if (favoriteShowId) {
                if (!validShowIds.has(favoriteShowId)) {
                    return res.status(400).json({ error: 'You can only pick a favorite show from shows you\'ve attended' });
                }
                updates.favorite_show_id = favoriteShowId;
            } else if (favoriteShowId !== undefined) {
                updates.favorite_show_id = null;
            }

            if (favoriteVenueId) {
                if (!validVenueIds.has(favoriteVenueId)) {
                    return res.status(400).json({ error: 'You can only pick a favorite venue from shows you\'ve attended' });
                }
                updates.favorite_venue_id = favoriteVenueId;
            } else if (favoriteVenueId !== undefined) {
                updates.favorite_venue_id = null;
            }
        }

        const { data, error } = await supabaseAdmin
            .from('profiles')
            .update(updates)
            .eq('id', user.id)
            .select()
            .single();

        if (error) {
            console.error('[Update Profile] Error:', error);
            return res.status(500).json({ error: 'Failed to update profile' });
        }

        res.json(data);
    } catch (error) {
        console.error('[Update Profile] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/users/avatar
 * Upload/replace the logged-in user's avatar. Requires authentication.
 */
router.post('/avatar', uploadAvatarFile.single('avatar'), async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file provided' });
        }

        // Look up and delete the old avatar (if any) before uploading the new one.
        const { data: existingProfile } = await supabaseAdmin
            .from('profiles')
            .select('avatar_url')
            .eq('id', user.id)
            .single();

        if (existingProfile?.avatar_url) {
            const oldPath = existingProfile.avatar_url.split(`/${AVATARS_BUCKET}/`)[1];
            if (oldPath) {
                await supabaseAdmin.storage.from(AVATARS_BUCKET).remove([oldPath]);
            }
        }

        const fileExt = req.file.originalname.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabaseAdmin.storage
            .from(AVATARS_BUCKET)
            .upload(fileName, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

        if (uploadError) {
            console.error('[Avatar Upload] Storage error:', uploadError);
            return res.status(500).json({ error: 'Failed to upload avatar' });
        }

        const { data: { publicUrl } } = supabaseAdmin.storage.from(AVATARS_BUCKET).getPublicUrl(fileName);

        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) {
            console.error('[Avatar Upload] DB update error, removing orphaned upload:', updateError);
            await supabaseAdmin.storage.from(AVATARS_BUCKET).remove([fileName]);
            return res.status(500).json({ error: 'Failed to save avatar' });
        }

        res.json({ avatarUrl: publicUrl });
    } catch (error) {
        console.error('[Avatar Upload] Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/check-attendance/:showId
 * Check if user has marked a specific show as attended
 * Requires authentication
 */
router.get('/check-attendance/:showId', async (req, res) => {
    try {
        const { showId } = req.params;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.status(401).json({ error: 'No authorization header' });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { data, error } = await supabase
            .from('user_shows')
            .select('id')
            .eq('user_id', user.id)
            .eq('show_id', showId)
            .maybeSingle();

        if (error) {
            console.error('Error checking attendance:', error);
            return res.status(500).json({ error: 'Failed to check attendance' });
        }

        res.json({ attended: !!data });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/users/community-stats
 * Get site-wide community stats (members, photos, posters contributed).
 * Public — no authentication required
 */
router.get('/community-stats', async (req, res) => {
    try {
        const [membersResult, photosResult, postersResult] = await Promise.all([
            // Excludes accounts marked private (hide_from_directory), same definition
            // GET /directory already uses — otherwise this count and the Members page's
            // count diverge. .not(...'is', true) (rather than .eq(..., false)) so NULL
            // rows (the common case — most profiles never explicitly set this) still
            // count as "not hidden", matching the directory route's `!p.hide_from_directory`.
            supabase.from('profiles').select('*', { count: 'exact', head: true }).not('hide_from_directory', 'is', true),
            supabase.from('user_photos').select('*', { count: 'exact', head: true }),
            supabase.from('user_posters').select('*', { count: 'exact', head: true }),
        ]);

        if (membersResult.error) throw membersResult.error;
        if (photosResult.error) throw photosResult.error;
        if (postersResult.error) throw postersResult.error;

        res.json({
            members: membersResult.count || 0,
            photos: photosResult.count || 0,
            posters: postersResult.count || 0,
        });
    } catch (error) {
        console.error('[Community Stats] Error:', error);
        res.status(500).json({ error: 'Failed to fetch community statistics' });
    }
});

module.exports = router;


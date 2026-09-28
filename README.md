# SkySets.org

A full-stack web application for browsing and tracking Sturgill Simpson & Johnny Blue Skies concert setlists. Live at **[skysets.org](https://www.skysets.org)**.

Inspired by [Crowesbase.com](https://crowesbase.com). Initial setlist data imported from [setlist.fm](https://www.setlist.fm).

---

## Features

### Public
- **Search & browse** hundreds of shows by year, month, song, source type, or content (photos, notes, poster)
- **Setlist pages** with full song-by-song breakdown, set breaks, encores, segue ("jams into") chains, tease/partial tags, and cover vs. original tagging
- **Rarity & debut tracking** — per-tour rarity percentages and "Live Debut" / "Tour Debut" badges computed from the full performance history
- **Stats dashboard** — top songs, shows by year, opener breakdowns, tour-level song-gap tracking
- **Posters & Photos galleries** — community-uploaded show posters (regular + foil variants) and photos, with auto-generated thumbnails for fast-loading grids and server-side image optimization on upload
- **Links directory** — external JBS-affiliated sites (news, video channels, communities, poster artists), grouped into admin-manageable categories; a link can optionally be tied to a member account and shows "by @username" alongside it
- **Member directory** (requires login) — searchable list of every registered member, with a "SkySets.org Team" section highlighting admins/curators
- **Public member profiles** — avatar, bio, location, favorite show/venue, social links, poster collection, opt-in itemized attendance list and shareable show map
- **Homepage widgets** — most recent show, upcoming shows, on-this-day, site-wide song stats
- Instagram-ready setlist post generator (admin/editor tool) for sharing a show's setlist as a styled image

### Member (free account)
- Mark shows as attended; personal stats (songs seen/not seen, live & tour debuts witnessed, rarity, attendance streak)
- Song-themed attendance badges (thresholds at 1/5/10/25/50/75/100 shows)
- Shareable map overlay of attended shows
- Profile customization: display name, avatar, bio, location, favorite show/venue, Facebook/Reddit/Instagram links, and a public/private toggle for the itemized attended-shows list
- Upload photos and posters per show; maintain a poster collection and a "posters wanted" wishlist
- Per-show notes, and community setlist submissions for shows missing an official setlist (with admin/editor merge-in)

### Editor (`profiles.role = 'editor'`)
- Everything a member can do, plus:
- Create/edit shows, songs, venues, albums, bands, and setlists
- Manage the Links page and its categories
- Use the Instagram post generator and save tour-style presets
- Moderate (delete) any user's uploaded photos, posters, and notes
- **Cannot** delete shows/songs/albums, rename tours, or manage user accounts/roles — those remain admin-only

### Admin (`profiles.role = 'admin'`)
- Full editor permissions, plus deleting shows/songs/albums, renaming tours, and full user management (list users, resend confirmation emails, trigger password resets, assign roles, delete accounts)
- Self-protection guards prevent an admin from demoting/deleting their own account or deleting another admin

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite (via `rolldown-vite`), Tailwind CSS, Porsche Design System v4 |
| Backend | Node.js + Express 5 (serverless on Vercel via `api/[...path].js`) |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth (email/password) |
| Image processing | `sharp` — re-encodes uploads (lossless WebP for graphics, mozjpeg for photos) and generates gallery thumbnails |
| Maps | Leaflet / react-leaflet (attended-shows map) |
| Charts | Recharts (stats dashboard) |
| Deployment | Vercel (static frontend + one serverless API function) |

---

## Project Structure

```
BlueskiesBase/
├── client/                        # React frontend
│   └── src/
│       ├── components/
│       │   ├── SetlistEditor.jsx      # Admin setlist builder
│       │   ├── SetlistPreview.jsx
│       │   ├── SetlistSubmissionSection.jsx
│       │   ├── NotesSection.jsx       # Per-show community notes
│       │   ├── PhotosSection.jsx      # Photo uploads per show
│       │   ├── PostersSection.jsx     # Poster uploads per show (regular + foil)
│       │   ├── Avatar.jsx             # Shared avatar-or-initials rendering
│       │   ├── BadgesPanel.jsx
│       │   ├── MainNavTabs.jsx        # Top nav (horizontally scrollable on mobile)
│       │   ├── SongStatsWidget.jsx / TourStatsWidget.jsx / UserStatsWidget.jsx
│       │   ├── MostRecentShowWidget.jsx / UpcomingShowsWidget.jsx
│       │   ├── ShowMapShare.jsx        # Shareable attended-shows map
│       │   ├── InstagramFollowBanner.jsx
│       │   ├── SEO.jsx / ErrorBoundary.jsx / ProtectedRoute.jsx
│       │   └── admin/
│       │       └── InstagramPostGraphic.jsx   # Canvas-rendered Instagram post image
│       ├── contexts/
│       │   └── AuthContext.jsx        # Supabase auth state, role/isAdmin/isEditorOrAdmin
│       ├── pages/
│       │   ├── SearchPage.jsx / HomePage.jsx  # Main search + homepage
│       │   ├── ShowDetailPage.jsx     # Individual show + setlist
│       │   ├── StatsPage.jsx / TourStatsPage.jsx
│       │   ├── PostersPage.jsx / PhotosPage.jsx
│       │   ├── LinksPage.jsx          # Public links directory
│       │   ├── MembersPage.jsx        # Member directory (login required)
│       │   ├── ProfilePage.jsx / EditProfilePage.jsx
│       │   ├── MemberLoginPage.jsx / SignupPage.jsx / ResetPasswordPage.jsx
│       │   └── admin/
│       │       ├── AdminLayout.jsx / AdminDashboard.jsx / AdminUsers.jsx
│       │       ├── ShowsList.jsx / ShowForm.jsx
│       │       ├── SongsList.jsx / SongForm.jsx
│       │       ├── AlbumsList.jsx / AlbumForm.jsx
│       │       ├── LinksList.jsx / LinkForm.jsx
│       │       ├── ToursList.jsx / TourEditPage.jsx
│       │       └── InstagramPostPage.jsx
│       └── services/
│           ├── api.js                 # Express API client
│           └── supabase.js            # Supabase browser client
├── server/
│   ├── routes/
│   │   ├── shows.js / songs.js / venues.js / albums.js / bands.js
│   │   ├── search.js
│   │   ├── links.js                   # Links + link_categories
│   │   ├── notes.js / photos.js / posters.js
│   │   ├── setlist-submissions.js
│   │   ├── users.js                   # Profile, attendance, stats, directory
│   │   ├── admin.js                   # User management, roles, tour-style
│   │   └── sitemap.js
│   ├── middleware/
│   │   └── requireRole.js             # requireAdmin / requireEditorOrAdmin
│   ├── utils/
│   │   ├── attendance.js / debuts.js / funStats.js / songStats.js
│   │   └── imageProcessing.js         # sharp-based optimize + thumbnail helpers
│   └── config/
│       └── supabase.js                # Supabase service-role client
├── api/
│   └── [...path].js                   # Vercel serverless entry point — mirrors app.js's route mounts
├── database/
│   ├── schema.sql                     # Original base schema + RLS policies
│   ├── seed_sample_data.sql
│   └── migrations/                    # A couple of early one-off migrations
├── scripts/
│   ├── migrations/                    # The actively-maintained migration history — run manually
│   │   └── *.sql                      #   in the Supabase SQL Editor, in filename order
│   ├── backfill_thumbnails.js         # One-off: generate thumbnails for existing posters/photos
│   ├── optimize_existing_images.js    # One-off: re-compress existing full-size images
│   └── *.js / *.py                    # Assorted setlist.fm import/repair/verification scripts
├── app.js                             # Express server (local dev)
├── vercel.json
└── package.json
```

---

## Local Development

### Prerequisites

- Node.js v18+
- A [Supabase](https://supabase.com) project (free tier works)

### Setup

1. **Clone the repo and install dependencies**

   ```bash
   git clone https://github.com/dlevy/BlueskiesBase.git
   cd BlueskiesBase
   npm install
   cd client && npm install && cd ..
   ```

2. **Configure environment variables**

   Copy `.env.example` to `.env` and fill in your credentials:

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your_service_role_key
   ```

   Then create `client/.env.local`:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Set up the database**

   In the Supabase SQL Editor, run in order:
   - `database/schema.sql` — base tables + RLS policies
   - `database/seed_sample_data.sql` — optional sample data
   - Everything in `database/migrations/`, then everything in `scripts/migrations/`, **in filename/date order** — this is the real, actively-maintained migration history and is not optional; several features (editor roles, thumbnails, links, etc.) depend on columns/tables added here.

4. **Run the dev server**

   ```bash
   npm run dev:all
   ```

   This starts both the Express API (`localhost:3000`) and the Vite dev server (`localhost:5173`) concurrently.

   > **Note:** The backend uses plain `node app.js` with no hot reload. Restart the server after any changes to `server/` or `app.js`.

---

## API Endpoints

All endpoints are prefixed `/api/`. Auth column: **Public** (no token), **Auth** (any signed-in user), **Editor+** (`requireEditorOrAdmin`), **Admin** (`requireAdmin`).

### Shows — `/api/shows`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/` | Public | All shows (paginated, filterable by date range) |
| GET | `/lookup` | Public | Resolve a show ID from its URL slug parts |
| GET | `/:id` | Public | Single show with full setlist |
| GET | `/:id/adjacent` | Public | Previous/next show by date |
| GET | `/:id/tour-rarity` | Public | Per-song play-count rarity for the show's tour |
| GET | `/:id/debuts` | Public | Live/tour debut song IDs for this show |
| GET | `/:id/attendees` | Public | Members who marked this show attended (usernames only) |
| POST | `/debuts-batch` | Public | Debuts for many shows at once |
| POST | `/` | Editor+ | Create a show |
| PUT | `/:id` | Editor+ | Update a show |
| PATCH | `/:id/tour` | Editor+ | Reassign a show's tour only |
| PUT | `/:id/setlist` | Editor+ | Replace a show's entire setlist |
| POST | `/:id/setlist/song` | Editor+ | Add one song to a setlist |
| DELETE | `/:showId/setlist/:setlistId` | Editor+ | Remove one setlist row |
| DELETE | `/:id` | Admin | Delete a show and all dependent rows |

### Songs / Albums / Venues / Bands
Standard CRUD under `/api/songs`, `/api/albums`, `/api/venues`, `/api/bands` — reads are public, create/update are Editor+, delete is Admin (venues/bands have no delete route). Albums additionally expose `/api/albums/:id/songs` for managing track order.

### Links — `/api/links`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/categories` | Public | List categories in display order |
| POST / PUT / DELETE | `/categories`, `/categories/:id` | Editor+ / Admin (delete) | Manage categories |
| GET | `/` | Public | All links, each with its category and optional associated member embedded |
| POST / PUT / DELETE | `/`, `/:id` | Editor+ / Admin (delete) | Manage links |

### Search — `/api/search`
| Method | Path | Description |
|---|---|---|
| GET | `/shows` | Filter shows by year/month/day/venue/city/state/song/source/hasNotes/hasPhotos/hasPoster |
| GET | `/songs` | Filter songs by title/original |

### Users & Profiles — `/api/users`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET/POST/DELETE | `/attended-shows`, `/attended-shows/:showId` | Auth | Manage the caller's attended shows |
| GET | `/stats` | Auth | Caller's personal stats |
| GET | `/directory` | Auth | Every member's public-safe fields (never email) |
| GET | `/profile/:username` | Public | A member's public profile |
| PUT | `/profile` | Auth | Update the caller's own opt-in profile fields |
| POST | `/avatar` | Auth | Upload/replace the caller's avatar |
| GET | `/community-stats` | Public | Site-wide member/photo/poster counts + top contributors |

### Photos / Posters — `/api/photos`, `/api/posters`
Public reads (including `/api/posters/collection` and `/api/posters/wants` sub-resources for a member's own poster collection/wishlist, auth required); upload/update/delete require auth and ownership (or editor/admin to moderate). Uploads are auto-optimized and get a generated thumbnail.

### Notes / Setlist Submissions — `/api/notes`, `/api/setlist-submissions`
Public reads, auth required to create/delete your own; submissions additionally support an admin/editor "merge into official setlist" action.

### Admin — `/api/admin` (all Admin-only)
| Method | Path | Description |
|---|---|---|
| GET | `/users` | List all users with role and confirmation status |
| POST | `/users/:userId/resend-confirmation` | Resend the activation email |
| POST | `/users/:userId/send-password-reset` | Trigger a password-reset email |
| PUT | `/users/:userId/role` | Assign `member` / `editor` / `admin` |
| DELETE | `/users/:userId` | Delete a user account |
| GET/PUT | `/tour-style/:tourName` | Instagram post style preset per tour (Editor+) |
| PUT | `/tours/:tourName/rename` | Rename a tour across every show in it |

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase auth users — `role` (`member`/`editor`/`admin`), legacy `is_admin`, avatar/bio/location, social links, favorite show/venue, attendance-privacy toggle |
| `venues` | Concert venues with city/state |
| `shows` | Individual concerts — tour name, source types, opener (`opened_for_id` → `bands`), poster artist credit, links (JSONB) |
| `songs` | Song catalog — `is_original`, cover attribution, writer credit |
| `albums` / `album_songs` | Album catalog and its song ↔ album junction (track order) |
| `setlist_songs` | Songs performed per show — set number, position, segue (`jams_into`), performance type (full/tease/partial) |
| `bands` | Support acts |
| `link_categories` / `links` | Admin-managed categories and external links for the public Links page; a link may optionally reference a `profiles` member |
| `user_shows` | Shows a member attended |
| `user_notes` | Per-show text notes |
| `user_photos` | Photo uploads per show (full image + generated thumbnail) |
| `user_posters` | Poster uploads per show, regular + foil variant (full image + generated thumbnail) |
| `user_poster_collection` / `user_poster_wants` | A member's owned posters and wishlist |
| `setlist_submissions` | Community-submitted setlists for shows missing an official one |

All tables have Row Level Security enabled as a defensive baseline, but the Express backend connects with the Supabase **service-role key** and bypasses RLS — the real authorization boundary is the `requireAdmin`/`requireEditorOrAdmin` Express middleware (`server/middleware/requireRole.js`), applied per-route.

---

## Deployment

The app is deployed on Vercel. The frontend is a static Vite build; the backend runs as a single serverless function (`api/[...path].js`) that mounts all the same Express routes as local `app.js`.

> **Important:** `app.js` (local dev) and `api/[...path].js` (Vercel) each mount routes independently — adding a new route file to one and forgetting the other means it works locally but 404s in production. Always update both.

### Environment variables to set in Vercel

```
SUPABASE_URL
SUPABASE_SERVICE_KEY
VITE_SUPABASE_URL       # build-time, prefixed VITE_
VITE_SUPABASE_ANON_KEY  # build-time, prefixed VITE_
```

See `DEPLOYMENT_GUIDE.md` for the full Vercel setup walkthrough.

---

## Contributing

Pull requests are welcome. A few things to know before diving in:

- **Two entry points, kept in sync**: see the Deployment note above — every new route mount belongs in both `app.js` and `api/[...path].js`.
- **Migrations are manual**: there's no `exec_sql` RPC. Every schema change is a plain `.sql` file added to `scripts/migrations/` and run by hand in the Supabase SQL Editor — nothing applies it automatically.
- **Porsche Design System**: The UI uses PDS v4 component library. Use `style={{ color: 'var(--p-color-contrast-low)' }}` inline styles instead of `color="contrast-low"` prop — the prop value is invalid in this version.
- **No hot reload on the backend**: The dev script runs `node app.js`. Restart the server after any backend changes or your edits won't take effect.
- **Auth multi-tab**: Supabase uses rotating refresh tokens. Don't call `supabase.auth.getSession()` for initial auth state — use `onAuthStateChange` only (see `AuthContext.jsx` for the pattern).
- **Supabase Storage cache-control is a no-op**: setting `cacheControl` on upload does not change what `Cache-Control` header the public object endpoint actually serves (confirmed by direct testing) — don't rely on it for egress savings. Image *size* (via `server/utils/imageProcessing.js`) is what actually reduces egress.
- **Supabase schema cache**: After adding columns via SQL Editor, run `NOTIFY pgrst, 'reload schema';` if PostgREST doesn't pick up the change immediately.

---

## License

ISC

## Acknowledgments

- Inspired by [Crowesbase.com](https://crowesbase.com)
- Setlist data imported from [setlist.fm](https://www.setlist.fm)
- Built for Sturgill Simpson & Johnny Blue Skies fans

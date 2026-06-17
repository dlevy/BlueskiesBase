# SkySets.org

A full-stack web application for browsing and tracking Sturgill Simpson & Johnny Blue Skies concert setlists. Live at **[skysets.org](https://www.skysets.org)**.

Inspired by [Crowesbase.com](https://crowesbase.com). Initial setlist data imported from [setlist.fm](https://www.setlist.fm).

---

## Features

### Public
- **Search & browse** 400+ shows by year, month, song, source type, or content (photos, notes, poster)
- **Setlist pages** with full song-by-song breakdown, set breaks, encores, and segue indicators
- **Videos & links** — embedded YouTube videos and external links attached per show
- **Stats dashboard** — top songs, shows by year, opener breakdowns, song gap tracker
- **On This Day** widget — shows that happened on today's date in past years

### Member (free account)
- Mark shows as attended
- Personal stats: shows seen, songs heard, songs not yet seen, attendance streak
- Song-themed badge system
- Shareable map overlay of attended shows

### Admin
- Full CRUD for shows, songs, albums, and venues
- Visual setlist editor with drag-and-drop-style song management, set breaks, and segue support
- Support act management per show
- Attach YouTube embeds and external links to shows
- Import setlists directly from the setlist.fm API
- User management panel with signup chart and activation email resend
- Secure admin-only routes protected by Supabase RLS + `is_admin` profile flag

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, Tailwind CSS v4, Porsche Design System v4 |
| Backend | Node.js + Express (serverless on Vercel via `api/[...path].js`) |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth (email/password, PKCE flow) |
| Deployment | Vercel (frontend + serverless API) |
| AI | Anthropic Claude API (chat widget) |

---

## Project Structure

```
BlueskiesBase/
├── client/                        # React frontend
│   └── src/
│       ├── components/
│       │   ├── SetlistEditor.jsx  # Admin setlist builder
│       │   ├── NotesSection.jsx   # Per-show community notes
│       │   ├── PhotosSection.jsx  # Photo uploads per show
│       │   ├── PostersSection.jsx # Poster uploads per show
│       │   ├── SongStatsWidget.jsx
│       │   ├── UserStatsWidget.jsx
│       │   ├── OnThisDayWidget.jsx
│       │   ├── ChatWidget.jsx     # AI chat (Claude)
│       │   ├── ShowMapShare.jsx   # Shareable attended-shows map
│       │   ├── SEO.jsx
│       │   └── ProtectedRoute.jsx
│       ├── contexts/
│       │   └── AuthContext.jsx    # Supabase auth state
│       ├── pages/
│       │   ├── SearchPage.jsx     # Homepage / main search
│       │   ├── ShowDetailPage.jsx # Individual show + setlist
│       │   ├── StatsPage.jsx      # Site-wide stats
│       │   ├── MemberLoginPage.jsx
│       │   ├── SignupPage.jsx
│       │   └── admin/
│       │       ├── AdminDashboard.jsx
│       │       ├── ShowsList.jsx
│       │       ├── ShowForm.jsx   # Create / edit shows + setlist
│       │       ├── SongsList.jsx
│       │       ├── SongForm.jsx
│       │       ├── AlbumsList.jsx
│       │       ├── AlbumForm.jsx
│       │       └── AdminUsers.jsx
│       └── services/
│           ├── api.js             # Express API client
│           └── supabase.js        # Supabase browser client
├── server/
│   ├── routes/
│   │   ├── shows.js
│   │   ├── songs.js
│   │   ├── venues.js
│   │   ├── search.js
│   │   ├── albums.js
│   │   ├── bands.js
│   │   ├── notes.js
│   │   ├── photos.js
│   │   ├── posters.js
│   │   ├── users.js
│   │   ├── chat.js
│   │   └── sitemap.js
│   └── config/
│       └── supabase.js            # Supabase service-role client
├── api/
│   └── [...path].js               # Vercel serverless entry point
├── database/
│   ├── schema.sql                 # Full schema + RLS policies
│   ├── seed_sample_data.sql
│   └── migrations/                # Incremental SQL migrations
├── app.js                         # Express server (local dev)
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

   ```bash
   cp .env.example .env
   ```

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your_service_role_key
   ANTHROPIC_API_KEY=your_anthropic_api_key   # optional, powers chat widget
   ```

   Then create `client/.env.local`:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```

3. **Set up the database**

   In the Supabase SQL Editor, run:
   - `database/schema.sql` — creates all tables and RLS policies
   - `database/seed_sample_data.sql` — optional sample data
   - Any files in `database/migrations/` — incremental additions

4. **Run the dev server**

   ```bash
   npm run dev:all
   ```

   This starts both the Express API (`localhost:3000`) and the Vite dev server (`localhost:5173`) concurrently.

   > **Note:** The backend uses plain `node app.js` with no hot reload. Restart the server after any changes to `server/` or `app.js`.

---

## API Endpoints

All endpoints are prefixed `/api/`.

### Shows
| Method | Path | Description |
|---|---|---|
| GET | `/api/shows` | All shows (paginated) |
| GET | `/api/shows/:id` | Single show with full setlist |
| POST | `/api/shows` | Create show (admin) |
| PUT | `/api/shows/:id` | Update show (admin) |
| DELETE | `/api/shows/:id` | Delete show + dependent rows (admin) |

### Search
| Method | Path | Description |
|---|---|---|
| GET | `/api/search/shows` | Search shows — params: `year`, `month`, `song`, `source`, `hasImages`, `hasNotes`, `hasPhotos`, `hasPoster` |
| GET | `/api/search/songs` | Search songs — params: `title`, `original` |

### Songs / Albums / Venues / Bands
Standard CRUD under `/api/songs`, `/api/albums`, `/api/venues`, `/api/bands`.

### User features
- `POST /api/user/shows/:id/attend` — mark show attended
- `DELETE /api/user/shows/:id/attend` — unmark
- `GET /api/user/shows/attendance/batch` — batch attendance check

### Admin
- `GET /api/admin/users` — list all users
- `POST /api/admin/users/:id/resend-activation` — resend confirmation email

---

## Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase auth users; stores `is_admin` flag |
| `venues` | Concert venues with city/state |
| `shows` | Individual concerts; includes `links` JSONB for videos/URLs |
| `songs` | Song catalog with `is_original` flag |
| `albums` | Album catalog |
| `album_songs` | Song ↔ album junction (track order) |
| `setlist_songs` | Songs performed per show (set number, position, segue) |
| `bands` | Support acts |
| `show_bands` | Show ↔ band junction |
| `user_shows` | Shows a user attended |
| `user_notes` | Per-show text notes by users |
| `user_photos` | Photo uploads per show |
| `user_posters` | Poster uploads per show |

All tables have Row Level Security enabled. Public data is readable by everyone; writes require authentication, and admin operations additionally require `profiles.is_admin = true`.

---

## Deployment

The app is deployed on Vercel. The frontend is a static Vite build; the backend runs as a single serverless function (`api/[...path].js`) that loads all Express routes.

### Environment variables to set in Vercel

```
SUPABASE_URL
SUPABASE_SERVICE_KEY
ANTHROPIC_API_KEY
VITE_SUPABASE_URL       # build-time, prefixed VITE_
VITE_SUPABASE_ANON_KEY  # build-time, prefixed VITE_
```

See `DEPLOYMENT_GUIDE.md` for the full Vercel setup walkthrough.

---

## Contributing

Pull requests are welcome. A few things to know before diving in:

- **Porsche Design System**: The UI uses PDS v4 component library. Use `style={{ color: 'var(--p-color-contrast-low)' }}` inline styles instead of `color="contrast-low"` prop — the prop value is invalid in this version.
- **No hot reload on the backend**: The dev script runs `node app.js`. Restart the server after any backend changes or your edits won't take effect.
- **Auth multi-tab**: Supabase uses rotating refresh tokens. Don't call `supabase.auth.getSession()` for initial auth state — use `onAuthStateChange` only (see `AuthContext.jsx` for the pattern).
- **Supabase schema cache**: After adding columns via SQL Editor, run `NOTIFY pgrst, 'reload schema';` or use an RPC function to update JSONB columns until PostgREST picks up the change.

---

## License

ISC

## Acknowledgments

- Inspired by [Crowesbase.com](https://crowesbase.com)
- Setlist data imported from [setlist.fm](https://www.setlist.fm)
- Built for Sturgill Simpson & Johnny Blue Skies fans

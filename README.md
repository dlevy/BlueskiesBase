# blueskiesbase 🎵

A modern web application for tracking Johnny Blue Skies (Sturgill Simpson) concert setlists. Search shows by date, venue, location, and songs. Authenticated users can mark shows they attended and view personal statistics.

## Features

### Core Functionality
- 🔍 **Advanced Search**: Search by date, venue, city, state/country, and song title
- 📋 **Setlist Display**: View complete setlists with set breaks and encore information
- 🎤 **Song Database**: Browse all songs with performance history
- 🏟️ **Venue Information**: View all shows at specific venues

### User Features
- 👤 **User Authentication**: Sign up and log in with email/password
- ✅ **Mark Shows Attended**: Keep track of shows you've been to
- 📊 **Personal Stats**: View your concert history, songs seen, and songs not yet seen
- 🎵 **Song Statistics**: See how many times you've seen each song
- 📅 **Show History**: Track all shows you've attended with dates and venues

### Admin Features
- ➕ **Add Shows**: Create new show entries with full setlist editor
- ✏️ **Edit Shows**: Update existing show information and setlists
- 🎵 **Manage Songs**: Add and edit song database with cover song detection
- 🏟️ **Manage Venues**: Add and edit venue information
- 🔒 **Secure Access**: Admin-only routes protected by authentication and authorization
- 📥 **Import from setlist.fm**: Bulk import setlists from setlist.fm API

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Project Structure

```
BlueskiesBase/
├── client/                    # React frontend (to be created)
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API calls and Supabase client
│   │   ├── hooks/            # Custom React hooks
│   │   └── App.jsx
│   └── package.json
├── server/                    # Express backend
│   ├── config/
│   │   └── supabase.js       # Supabase client configuration
│   └── routes/
│       ├── shows.js          # Show endpoints
│       ├── songs.js          # Song endpoints
│       ├── venues.js         # Venue endpoints
│       └── search.js         # Search endpoints
├── database/
│   ├── schema.sql            # Database schema
│   └── seed_sample_data.sql  # Sample data
├── app.js                     # Express server
├── package.json
├── PROJECT_PLAN.md           # Detailed project plan
└── SETUP_GUIDE.md            # Step-by-step setup instructions

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- A Supabase account (free tier is fine)

### Installation

1. **Clone and install dependencies**
   ```bash
   npm install
   ```

2. **Set up Supabase**
   - Create a free account at [supabase.com](https://supabase.com)
   - Create a new project
   - Run the SQL from `database/schema.sql` in the Supabase SQL Editor
   - Optionally run `database/seed_sample_data.sql` for sample data

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your Supabase credentials:
   ```
   PORT=3000
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_SERVICE_KEY=your_supabase_service_role_key
   ```

4. **Start the backend server**
   ```bash
   npm run dev
   ```
   
   The API will be available at `http://localhost:3000`

### Next Steps: Setting Up the Frontend

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed instructions on:
1. Creating the React frontend with Vite
2. Installing and configuring Tailwind CSS
3. Setting up the Supabase client
4. Building the search interface
5. Creating the setlist display pages

## API Endpoints

### Shows
- `GET /api/shows` - Get all shows (paginated)
- `GET /api/shows/:id` - Get a single show with full setlist
- `POST /api/shows` - Create a new show (admin only)
- `PUT /api/shows/:id` - Update a show (admin only)
- `DELETE /api/shows/:id` - Delete a show (admin only)

### Songs
- `GET /api/songs` - Get all songs
- `GET /api/songs/:id` - Get a single song with performance history
- `POST /api/songs` - Create a new song (admin only)

### Venues
- `GET /api/venues` - Get all venues
- `GET /api/venues/:id` - Get a single venue with all shows
- `POST /api/venues` - Create a new venue (admin only)

### Search
- `GET /api/search/shows` - Search shows with filters
  - Query params: `year`, `month`, `day`, `venue`, `city`, `state`, `song`, `source`, `hasImages`
- `GET /api/search/songs` - Search songs
  - Query params: `title`, `original`

## Database Schema

The database consists of 7 main tables:
- **profiles** - User accounts (extends Supabase auth)
- **venues** - Concert venues
- **shows** - Individual concerts
- **songs** - Song catalog
- **setlist_songs** - Songs performed at each show (junction table)
- **user_shows** - Shows user attended
- **user_recordings** - Recordings user owns

See `database/schema.sql` for the complete schema with Row Level Security policies.

## Development Status

- [x] Project setup and architecture
- [x] Database schema design with Row Level Security
- [x] Backend API endpoints (shows, songs, venues, search, users)
- [x] React frontend with Vite and Tailwind CSS
- [x] Advanced search interface with cascading filters
- [x] Setlist display pages with set breaks
- [x] User authentication (signup/login)
- [x] User features (mark shows attended, personal stats)
- [x] Admin panel with full CRUD operations
- [x] Setlist editor with visual builder
- [x] Import from setlist.fm API (443 shows imported)
- [x] Dark mode theme
- [x] Security: Admin authorization and RLS policies
- [ ] Custom domain and production deployment
- [ ] Recording tracking feature
- [ ] Image upload and galleries

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

ISC

## Acknowledgments

- Inspired by [Crowesbase.com](https://crowesbase.com)
- Setlist data imported from [setlist.fm](https://www.setlist.fm)
- Built for Johnny Blue Skies / Sturgill Simpson fans


# BlueskiesBase - Setlist Database Application

## Project Overview
A web application for searching and browsing concert setlists, similar to Crowesbase.com. Users can search for shows by date, venue, location, and songs. Authenticated users can mark shows they attended and recordings they own.

## Tech Stack
- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Core Features

### 1. Search & Browse
- Search by date (year, month, day)
- Search by venue name
- Search by city/state/country
- Search by song title
- Filter by source availability (AUD, SBD, VIDEO, etc.)
- Filter by shows with images

### 2. Setlist Display
- Show date, venue, location
- Complete setlist with set breaks
- Song notes and special performances
- Source information
- Images (if available)

### 3. User Features (Authenticated)
- User registration/login
- Mark shows attended
- Mark recordings owned
- View personal collection

### 4. Admin Features
- Add new shows
- Edit existing shows
- Add/edit songs
- Add/edit venues
- Manage setlists

## Database Schema

### Tables:
1. **users** - User accounts and authentication
2. **venues** - Concert venues
3. **shows** - Individual concerts
4. **songs** - Song catalog
5. **setlist_songs** - Songs performed at each show
6. **user_shows** - Shows user attended
7. **user_recordings** - Recordings user owns

## Project Structure
```
BlueskiesBase/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── services/      # API calls
│   │   ├── hooks/         # Custom React hooks
│   │   ├── context/       # React context (auth, etc.)
│   │   └── App.jsx
│   ├── public/
│   └── package.json
├── server/                # Express backend
│   ├── routes/           # API routes
│   ├── middleware/       # Auth, validation, etc.
│   ├── controllers/      # Route handlers
│   └── app.js
├── database/             # Database migrations & seeds
│   ├── migrations/
│   └── seeds/
└── package.json
```

## Implementation Phases

### Phase 1: Setup & Infrastructure
- [x] Initialize Express server
- [ ] Set up Supabase project
- [ ] Create database schema
- [ ] Initialize React frontend
- [ ] Set up Tailwind CSS

### Phase 2: Core Search Functionality
- [ ] Build search API endpoints
- [ ] Create search UI components
- [ ] Implement search filters
- [ ] Display search results

### Phase 3: Setlist Display
- [ ] Create setlist detail page
- [ ] Format setlist display
- [ ] Add song information

### Phase 4: User Authentication
- [ ] Implement Supabase Auth
- [ ] Create login/signup UI
- [ ] Protect user routes

### Phase 5: User Features
- [ ] Mark shows attended
- [ ] Mark recordings owned
- [ ] User profile page
- [ ] Personal collection view

### Phase 6: Admin Panel
- [ ] Admin authentication
- [ ] Add show form
- [ ] Edit show form
- [ ] Manage songs/venues

## Next Steps
1. Create Supabase account and project
2. Set up database tables
3. Initialize React frontend
4. Build basic search functionality


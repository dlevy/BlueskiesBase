# Next Steps to Get BlueskiesBase Running

## What We've Built So Far ✅

1. **Database Schema** - Complete PostgreSQL schema with Row Level Security
2. **Backend API** - Express server with routes for shows, songs, venues, and search
3. **Project Structure** - Organized folder structure ready for frontend
4. **Documentation** - Comprehensive guides and plans

## Immediate Next Steps

### Step 1: Install Backend Dependencies

Run this command in your project root:
```bash
npm install
```

This will install:
- `@supabase/supabase-js` - Supabase client
- `cors` - Enable CORS for frontend communication
- `dotenv` - Environment variable management
- `express` - Web server
- `concurrently` - Run multiple processes

### Step 2: Set Up Supabase

1. **Create a Supabase account** (if you haven't already)
   - Go to https://supabase.com
   - Sign up for free
   - Create a new project (choose a name like "BlueskiesBase")
   - Save your database password!

2. **Set up the database**
   - In Supabase dashboard, go to **SQL Editor**
   - Copy the entire contents of `database/schema.sql`
   - Paste into the SQL Editor
   - Click **Run** to create all tables

3. **Add sample data** (optional but recommended)
   - In SQL Editor, copy contents of `database/seed_sample_data.sql`
   - Paste and run
   - This gives you sample shows to test with

4. **Get your API keys**
   - Go to **Project Settings** > **API**
   - Copy your **Project URL**
   - Copy your **service_role key** (not the anon key for backend)

### Step 3: Configure Environment Variables

1. Copy the example file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Supabase credentials:
   ```
   PORT=3000
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### Step 4: Test the Backend

Start the server:
```bash
npm run dev
```

You should see:
```
🚀 BlueskiesBase API server running on port 3000
📍 http://localhost:3000
```

Test it by visiting http://localhost:3000 in your browser. You should see:
```json
{
  "message": "BlueskiesBase API",
  "version": "1.0.0",
  "status": "running"
}
```

Test the API endpoints:
- http://localhost:3000/api/shows - Should return shows (if you added sample data)
- http://localhost:3000/api/songs - Should return songs
- http://localhost:3000/api/venues - Should return venues

### Step 5: Set Up the Frontend

Now we'll create the React frontend:

```bash
# Create React app with Vite
npm create vite@latest client -- --template react

# Navigate to client folder
cd client

# Install dependencies
npm install

# Install Supabase client
npm install @supabase/supabase-js

# Install React Router
npm install react-router-dom

# Install Tailwind CSS v4
npm install tailwindcss@next @tailwindcss/vite@next

# Install UI libraries (optional but recommended)
npm install @headlessui/react @heroicons/react
```

### Step 6: Configure the Frontend

1. **Set up Tailwind CSS v4**

   Edit `client/vite.config.js`:
   ```javascript
   import { defineConfig } from 'vite'
   import react from '@vitejs/plugin-react'
   import tailwindcss from '@tailwindcss/vite'

   export default defineConfig({
     plugins: [react(), tailwindcss()],
   })
   ```

   Edit `client/src/index.css`:
   ```css
   @import "tailwindcss";
   ```

2. **Create environment variables**
   
   Create `client/.env`:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```
   
   **Note:** For the frontend, use the **anon/public key**, not the service role key!

### Step 7: Run Both Frontend and Backend

From the project root:
```bash
npm run dev:all
```

This will start:
- Backend API on http://localhost:3000
- Frontend on http://localhost:5173

## What to Build Next

### Priority 1: Basic Search Page
Create a search interface where users can:
- Search by date (year, month, day dropdowns)
- Search by venue name
- Search by city/state
- View search results

### Priority 2: Setlist Display Page
Create a page to display:
- Show date and venue
- Complete setlist organized by sets
- Song information
- Source availability

### Priority 3: User Authentication
Implement:
- Login/signup forms
- Supabase Auth integration
- Protected routes

### Priority 4: User Features
Add ability to:
- Mark shows attended
- Mark recordings owned
- View personal collection

### Priority 5: Admin Panel
Create admin interface to:
- Add new shows
- Edit existing shows
- Manage songs and venues

## Need Help?

Refer to these files:
- `PROJECT_PLAN.md` - Overall project architecture and features
- `SETUP_GUIDE.md` - Detailed setup instructions
- `README.md` - Project overview and API documentation
- `database/schema.sql` - Database structure

## Common Issues

### "Cannot find module '@supabase/supabase-js'"
Run `npm install` in the project root.

### "Missing environment variables"
Make sure you created `.env` file with your Supabase credentials.

### "CORS error" when calling API from frontend
Make sure CORS is enabled in `app.js` (it should be already).

### Database connection fails
- Check your Supabase URL and keys are correct
- Verify your Supabase project is active
- Check that you ran the schema.sql file

## Ready to Code!

Once you complete these steps, you'll have:
- ✅ A working backend API
- ✅ A React frontend ready for development
- ✅ Database with sample data
- ✅ All dependencies installed

You can then start building the search interface and setlist display pages!


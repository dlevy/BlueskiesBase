# 🚀 Quick Start Guide

## Get BlueskiesBase Running in 30 Minutes

### ⚡ Step 1: Install Backend Dependencies (2 min)
```bash
npm install
```

### ⚡ Step 2: Set Up Supabase (10 min)

1. **Create account**: Go to https://supabase.com and sign up
2. **Create project**: Click "New Project", name it "BlueskiesBase"
3. **Set up database**:
   - Go to SQL Editor in Supabase dashboard
   - Copy ALL content from `database/schema.sql`
   - Paste and click "Run"
4. **Add sample data** (optional):
   - Copy content from `database/seed_sample_data.sql`
   - Paste and click "Run"
5. **Get API keys**:
   - Go to Project Settings > API
   - Copy your **Project URL**
   - Copy your **service_role key** (the long one)

### ⚡ Step 3: Configure Environment (2 min)

Create a file named `.env` in the project root:
```bash
PORT=3000
SUPABASE_URL=paste_your_project_url_here
SUPABASE_SERVICE_KEY=paste_your_service_role_key_here
```

### ⚡ Step 4: Start Backend (1 min)
```bash
npm run dev
```

You should see:
```
🚀 BlueskiesBase API server running on port 3000
📍 http://localhost:3000
```

**Test it**: Open http://localhost:3000 in your browser

### ⚡ Step 5: Create Frontend (15 min)

```bash
# Create React app
npm create vite@latest client -- --template react

# Install dependencies
cd client
npm install

# Install required packages
npm install @supabase/supabase-js react-router-dom
npm install tailwindcss@next @tailwindcss/vite@next
```

**Configure Tailwind v4** - Edit `client/vite.config.js`:
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

**Update CSS** - Edit `client/src/index.css`:
```css
@import "tailwindcss";
```

**Create environment file** - Create `client/.env`:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```
(Get the **anon/public key** from Supabase Project Settings > API)

### ⚡ Step 6: Run Everything

From the project root:
```bash
npm run dev:all
```

This starts:
- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## 🎯 What You Have Now

✅ **Backend API** with endpoints for:
- Shows (list, detail, create, update, delete)
- Songs (list, detail, create)
- Venues (list, detail, create)
- Search (advanced filtering)

✅ **Database** with:
- Complete schema
- Sample data (5 shows, 20 songs, 5 venues)
- User authentication ready
- Row-level security

✅ **Frontend** ready for development

## 📝 Next: Build the UI

Use the templates in `client-templates/`:
1. Copy `supabase.js` to `client/src/services/supabase.js`
2. Copy `SearchPage.jsx` to `client/src/pages/SearchPage.jsx`
3. Update `client/src/App.jsx` to use the SearchPage

## 🆘 Troubleshooting

**"Cannot find module"**
→ Run `npm install` in project root

**"Missing environment variables"**
→ Check you created `.env` file with correct keys

**"CORS error"**
→ Backend should have CORS enabled (already configured)

**Database connection fails**
→ Verify Supabase URL and keys are correct

## 📚 Full Documentation

- `PROJECT_SUMMARY.md` - Complete overview
- `NEXT_STEPS.md` - Detailed next steps
- `SETUP_GUIDE.md` - In-depth setup guide
- `README.md` - API documentation

## 🎵 You're Ready!

Start building your search interface and setlist pages!


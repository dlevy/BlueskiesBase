# BlueskiesBase Setup Guide

## Step 1: Set Up Supabase

### 1.1 Create a Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project
   - Choose a project name (e.g., "BlueskiesBase")
   - Set a strong database password (save this!)
   - Select a region close to you

### 1.2 Set Up Database Schema
1. In your Supabase dashboard, go to the **SQL Editor**
2. Copy the contents of `database/schema.sql`
3. Paste it into the SQL Editor and click **Run**
4. This will create all your tables, indexes, and security policies

### 1.3 Add Sample Data (Optional)
1. In the SQL Editor, copy the contents of `database/seed_sample_data.sql`
2. Paste and run it to add sample shows and setlists
3. This helps you test the application immediately

### 1.4 Get Your API Keys
1. Go to **Project Settings** > **API**
2. Copy these values (you'll need them later):
   - **Project URL** (e.g., `https://sxkonriiudchfhkrrait.supabase.co`)
   - **anon/public key** (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4a29ucmlpdWRjaGZoa3JyYWl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI3MTgwMDAsImV4cCI6MjA3ODI5NDAwMH0.sQCPgZGxkMy7TigltRY2-tmPQLe74C9g0TX4uy32sio`)

## Step 2: Set Up the Frontend (React + Vite)

### 2.1 Initialize React App
```bash
# From the project root directory
npm create vite@latest client -- --template react
cd client
npm install
```

### 2.2 Install Dependencies
```bash
# Install Supabase client
npm install @supabase/supabase-js

# Install React Router for navigation
npm install react-router-dom

# Install Tailwind CSS v4
npm install tailwindcss@next @tailwindcss/vite@next

# Install additional UI libraries (optional but recommended)
npm install @headlessui/react @heroicons/react
```

### 2.3 Configure Tailwind CSS v4

Edit `client/vite.config.js` to add the Tailwind plugin:
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

**Note:** Tailwind v4 doesn't require a config file by default. If you need customization later, you can add it to your CSS file.

### 2.4 Create Environment Variables
Create `client/.env`:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Important:** Add `.env` to your `.gitignore` file!

## Step 3: Set Up the Backend (Express)

### 3.1 Install Backend Dependencies
```bash
# From the project root directory
npm install @supabase/supabase-js dotenv cors
```

### 3.2 Create Environment Variables
Create `.env` in the project root:
```
PORT=3000
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

**Note:** The service role key is different from the anon key. Find it in Supabase under Project Settings > API > service_role key.

### 3.3 Update package.json Scripts
Edit `package.json`:
```json
{
  "scripts": {
    "dev": "node app.js",
    "client": "cd client && npm run dev",
    "dev:all": "concurrently \"npm run dev\" \"npm run client\""
  }
}
```

Install concurrently for running both servers:
```bash
npm install -D concurrently
```

## Step 4: Project Structure

Your project should now look like this:
```
BlueskiesBase/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── package.json
├── server/                    # Express API (to be created)
│   ├── routes/
│   ├── controllers/
│   └── middleware/
├── database/
│   ├── schema.sql
│   └── seed_sample_data.sql
├── .env
├── .gitignore
├── app.js
├── package.json
├── PROJECT_PLAN.md
└── SETUP_GUIDE.md
```

## Step 5: Create .gitignore

Create/update `.gitignore`:
```
# Dependencies
node_modules/
client/node_modules/

# Environment variables
.env
.env.local
client/.env
client/.env.local

# Build outputs
client/dist/
client/build/

# Logs
*.log
npm-debug.log*

# OS files
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo
```

## Step 6: Running the Application

### Development Mode
```bash
# Run both frontend and backend together
npm run dev:all

# Or run them separately:
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
npm run client
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## Next Steps

1. **Create the Supabase client** in `client/src/services/supabase.js`
2. **Build the search page** with filters
3. **Create the setlist display page**
4. **Implement authentication** (login/signup)
5. **Build the admin panel** for adding shows

## Useful Resources

- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev)
- [Vite Documentation](https://vitejs.dev)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [React Router Documentation](https://reactrouter.com)

## Troubleshooting

### Database Connection Issues
- Verify your Supabase URL and keys are correct
- Check that Row Level Security policies are set up correctly
- Ensure your IP is allowed in Supabase (usually automatic)

### CORS Errors
- Make sure CORS is enabled in your Express app
- Check that the frontend URL is allowed

### Build Errors
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check that all dependencies are installed in both root and client directories


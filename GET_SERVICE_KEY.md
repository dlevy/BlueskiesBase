# How to Get Your Supabase Service Role Key

## ⚠️ Important: Service Role Key vs Anon Key

Your project needs **TWO different keys**:

1. **Anon/Public Key** - For the frontend (client)
   - ✅ Already added to `client/.env`
   - Safe to use in browser
   - Limited permissions

2. **Service Role Key** - For the backend (server)
   - ❌ Need to add to `.env` in project root
   - **NEVER** expose in frontend code
   - Full database access (admin privileges)

## 📝 Steps to Get Your Service Role Key

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project: "BlueskiesBase" (or whatever you named it)

2. **Navigate to API Settings**
   - Click on **Settings** (gear icon in sidebar)
   - Click on **API**

3. **Find Your Keys**
   You'll see two keys:
   
   - **anon/public** key (starts with `eyJhbGci...`)
     - This is what you already have in `client/.env` ✅
   
   - **service_role** key (also starts with `eyJhbGci...` but is different)
     - This is what you need for the backend ❌

4. **Copy the Service Role Key**
   - Click the copy button next to **service_role**
   - It will be a long string starting with `eyJhbGci...`

5. **Add to Backend .env File**
   - Open `.env` in the project root (not `client/.env`)
   - Replace `your_service_role_key_here` with your actual service role key
   
   Your `.env` should look like:
   ```
   PORT=3000
   SUPABASE_URL=https://sxkonriiudchfhkrrait.supabase.co
   SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4a29ucmlpdWRjaGZoa3JyYWl0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjcxODAwMCwiZXhwIjoyMDc4Mjk0MDAwfQ.XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

## 🔒 Security Notes

- **NEVER** commit the `.env` file to git (it's already in `.gitignore`)
- **NEVER** use the service role key in frontend code
- The service role key bypasses Row Level Security policies
- Keep it secret and secure!

## ✅ After Adding the Key

Once you've added your service role key to `.env`, you can test the backend:

```bash
npm run dev
```

Then visit: http://localhost:3000

You should see:
```json
{
  "message": "BlueskiesBase API",
  "version": "1.0.0",
  "status": "running"
}
```

## 🆘 Can't Find It?

If you can't find the service role key:
1. Make sure you're logged into Supabase
2. Make sure you've selected the correct project
3. Go to: Settings → API
4. Look for the section labeled "Project API keys"
5. The service_role key should be there (you may need to click "Reveal" to see it)


# 🚀 Quick Start: GitHub & Deployment

This is a condensed guide to get your app on GitHub and deployed in ~30 minutes.

---

## Part 1: Push to GitHub (5 minutes)

### **Step 1: Create GitHub Repository**

1. Go to https://github.com/new
2. Repository name: `blueskiesbase`
3. Description: "Johnny Blue Skies setlist database"
4. Choose **Private** or **Public**
5. **DO NOT** check any boxes (no README, .gitignore, or license)
6. Click **Create repository**

### **Step 2: Push Your Code**

Open PowerShell in your project directory and run:

```powershell
# Initialize git (if not already done)
git init

# Add all files
git add .

# Create first commit
git commit -m "Initial commit - blueskiesbase v1.0"

# Add GitHub remote (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/blueskiesbase.git

# Push to GitHub
git branch -M main
git push -u origin main
```

✅ **Done! Your code is on GitHub.**

---

## Part 2: Deploy Backend to Railway (10 minutes)

### **Step 1: Sign Up**

1. Go to https://railway.app
2. Click **Login with GitHub**
3. Authorize Railway

### **Step 2: Create Project**

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose `blueskiesbase`
4. Wait for initial deployment

### **Step 3: Configure**

1. Click on your service
2. Go to **Variables** tab
3. Add these variables:

```
PORT=3000
SUPABASE_URL=https://sxkonriiudchfhkrrait.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
NODE_ENV=production
```

**Get your service role key:**
- Supabase Dashboard → Settings → API → Copy `service_role` key

4. Go to **Settings** tab
5. Set **Start Command**: `node app.js`
6. Click **Deploy**

### **Step 4: Get Your Backend URL**

1. Go to **Settings** → **Networking**
2. Click **Generate Domain**
3. Copy the URL (e.g., `https://blueskiesbase-production.up.railway.app`)

✅ **Backend is live!**

---

## Part 3: Deploy Frontend to Vercel (10 minutes)

### **Step 1: Sign Up**

1. Go to https://vercel.com
2. Click **Sign Up with GitHub**
3. Authorize Vercel

### **Step 2: Import Project**

1. Click **Add New...** → **Project**
2. Find `blueskiesbase` repository
3. Click **Import**

### **Step 3: Configure Build**

1. **Framework Preset**: Vite
2. **Root Directory**: `client`
3. **Build Command**: `npm run build`
4. **Output Directory**: `dist`

### **Step 4: Add Environment Variables**

Add these in the **Environment Variables** section:

```
VITE_SUPABASE_URL=https://sxkonriiudchfhkrrait.supabase.co
VITE_SUPABASE_ANON_KEY=<your_anon_key>
VITE_API_URL=<your_railway_backend_url>
```

**Get your anon key:**
- Supabase Dashboard → Settings → API → Copy `anon public` key

**Use your Railway URL:**
- Example: `https://blueskiesbase-production.up.railway.app`

5. Click **Deploy**

✅ **Frontend is live!**

---

## Part 4: Final Configuration (5 minutes)

### **Step 1: Update API Configuration**

Edit `client/src/services/api.js`:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### **Step 2: Enable CORS**

Edit `app.js` and update CORS:

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://blueskiesbase.vercel.app',  // Your Vercel URL
    'https://*.vercel.app'
  ],
  credentials: true
}));
```

### **Step 3: Push Changes**

```powershell
git add .
git commit -m "Configure for production deployment"
git push
```

Both Railway and Vercel will auto-deploy!

---

## Part 5: Test Your App (5 minutes)

Visit your Vercel URL (e.g., `https://blueskiesbase.vercel.app`)

### **Test Checklist:**

- [ ] Homepage loads
- [ ] Search works (try searching by year)
- [ ] Click on a show to view setlist
- [ ] Login works (use your admin account)
- [ ] Admin panel accessible at `/admin`
- [ ] Stats page shows your data
- [ ] Mark a show as attended

---

## 🎉 You're Live!

Your app is now deployed at:
- **Frontend**: `https://blueskiesbase.vercel.app`
- **Backend**: `https://blueskiesbase-production.up.railway.app`

---

## 📝 Future Updates

To deploy updates:

```powershell
# Make your changes
git add .
git commit -m "Description of changes"
git push

# Railway and Vercel auto-deploy!
```

---

## 🔧 Troubleshooting

### **"Network Error" when searching**

Check that `VITE_API_URL` is set in Vercel:
1. Vercel Dashboard → Your Project → Settings → Environment Variables
2. Make sure `VITE_API_URL` points to your Railway URL
3. Redeploy: Deployments → Click ⋯ → Redeploy

### **"Access Denied" in admin panel**

Make sure your user is an admin:
1. Supabase Dashboard → Table Editor → `profiles`
2. Find your user (info@daniellevy.me)
3. Set `is_admin` to `true`
4. Log out and log back in

### **Backend not responding**

Check Railway logs:
1. Railway Dashboard → Your Service → Deployments
2. Click on latest deployment
3. View logs for errors

---

## 💰 Costs

All free tier:
- **Railway**: $5 free credit/month
- **Vercel**: Free for personal projects
- **Supabase**: Free tier (500MB database)

**Total: $0/month** for small-medium traffic!

---

## 🎸 Next Steps

- [ ] Set up custom domain (optional)
- [ ] Configure email notifications (optional)
- [ ] Add Google Analytics (optional)
- [ ] Set up monitoring/alerts (optional)

---

**Need more details?** See `DEPLOYMENT_GUIDE.md` for comprehensive instructions.


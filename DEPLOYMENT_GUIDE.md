# 🚀 Deployment Guide - blueskiesbase

This guide will walk you through deploying your blueskiesbase application to production.

---

## 📋 Table of Contents

1. [Push to GitHub](#1-push-to-github)
2. [Choose Hosting Platform](#2-choose-hosting-platform)
3. [Deploy Backend (Railway)](#3-deploy-backend-railway)
4. [Deploy Frontend (Vercel)](#4-deploy-frontend-vercel)
5. [Configure Environment Variables](#5-configure-environment-variables)
6. [Final Testing](#6-final-testing)

---

## 1. Push to GitHub

### **Step 1: Initialize Git Repository**

```powershell
# Navigate to your project directory
cd "C:\Users\info\Documents\VSCode Projects\BlueskiesBase"

# Initialize git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit - blueskiesbase v1.0"
```

### **Step 2: Create GitHub Repository**

1. Go to [github.com](https://github.com)
2. Click the **+** icon (top right) → **New repository**
3. Fill in:
   - **Repository name**: `blueskiesbase`
   - **Description**: "Johnny Blue Skies setlist database - track shows, songs, and concert history"
   - **Visibility**: Choose **Private** or **Public**
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **Create repository**

### **Step 3: Push to GitHub**

```powershell
# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/blueskiesbase.git

# Push to GitHub
git branch -M main
git push -u origin main
```

✅ **Your code is now on GitHub!**

---

## 2. Choose Hosting Platform

### **Recommended Setup:**

| Component | Platform | Cost | Why |
|-----------|----------|------|-----|
| **Backend** | Railway | Free tier | Easy Node.js deployment, auto-deploys from GitHub |
| **Frontend** | Vercel | Free tier | Optimized for React/Vite, auto-deploys from GitHub |
| **Database** | Supabase | Free tier | Already using it! |

### **Alternative Options:**

- **All-in-One**: Render (free tier) - Deploy both frontend and backend
- **Budget**: Netlify (frontend) + Railway (backend)
- **Enterprise**: AWS, Google Cloud, Azure

---

## 3. Deploy Backend (Railway)

### **Step 1: Sign Up for Railway**

1. Go to [railway.app](https://railway.app)
2. Click **Login** → **Login with GitHub**
3. Authorize Railway to access your GitHub account

### **Step 2: Create New Project**

1. Click **New Project**
2. Select **Deploy from GitHub repo**
3. Choose your `blueskiesbase` repository
4. Railway will detect it's a Node.js project

### **Step 3: Configure Backend**

1. Click on your service
2. Go to **Settings** tab
3. Set **Root Directory**: Leave empty (root of repo)
4. Set **Start Command**: `node app.js`
5. Set **Build Command**: `npm install`

### **Step 4: Add Environment Variables**

1. Go to **Variables** tab
2. Click **+ New Variable**
3. Add these variables:

```
PORT=3000
SUPABASE_URL=https://sxkonriiudchfhkrrait.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
NODE_ENV=production
```

**⚠️ IMPORTANT:** Get your `SUPABASE_SERVICE_ROLE_KEY` from:
- Supabase Dashboard → Project Settings → API → `service_role` key

### **Step 5: Deploy**

1. Click **Deploy**
2. Wait for deployment to complete (2-3 minutes)
3. Railway will give you a URL like: `https://blueskiesbase-production.up.railway.app`

✅ **Backend is live!**

---

## 4. Deploy Frontend (Vercel)

### **Step 1: Sign Up for Vercel**

1. Go to [vercel.com](https://vercel.com)
2. Click **Sign Up** → **Continue with GitHub**
3. Authorize Vercel to access your GitHub account

### **Step 2: Import Project**

1. Click **Add New...** → **Project**
2. Find and select your `blueskiesbase` repository
3. Click **Import**

### **Step 3: Configure Build Settings**

Vercel should auto-detect Vite, but verify:

- **Framework Preset**: Vite
- **Root Directory**: `client`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### **Step 4: Add Environment Variables**

1. Expand **Environment Variables** section
2. Add these variables:

```
VITE_SUPABASE_URL=https://sxkonriiudchfhkrrait.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_API_URL=https://blueskiesbase-production.up.railway.app
```

**⚠️ IMPORTANT:** 
- Get `VITE_SUPABASE_ANON_KEY` from Supabase Dashboard → Project Settings → API → `anon` key
- Replace `VITE_API_URL` with your actual Railway backend URL

### **Step 5: Deploy**

1. Click **Deploy**
2. Wait for deployment to complete (2-3 minutes)
3. Vercel will give you a URL like: `https://blueskiesbase.vercel.app`

✅ **Frontend is live!**

---

## 5. Configure Environment Variables

### **Update Frontend API Calls**

You need to update the frontend to use the production backend URL.

**Option 1: Use Environment Variable (Recommended)**

Edit `client/src/services/api.js`:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

Then redeploy from Vercel dashboard.

**Option 2: Hardcode Production URL**

Edit `client/src/services/api.js`:

```javascript
const API_URL = process.env.NODE_ENV === 'production' 
  ? 'https://blueskiesbase-production.up.railway.app'
  : 'http://localhost:3000';
```

### **Enable CORS on Backend**

Make sure your backend allows requests from your Vercel domain.

Edit `app.js` and update CORS configuration:

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://blueskiesbase.vercel.app',  // Add your Vercel URL
    'https://*.vercel.app'  // Allow all Vercel preview deployments
  ],
  credentials: true
}));
```

Commit and push:

```powershell
git add .
git commit -m "Configure CORS for production"
git push
```

Railway will auto-deploy the changes.

---

## 6. Final Testing

### **Test Checklist:**

- [ ] **Homepage loads** at your Vercel URL
- [ ] **Search works** - Try searching by year, venue, song
- [ ] **Show detail pages load** - Click on a show
- [ ] **Login works** - Try logging in with your admin account
- [ ] **Admin panel accessible** - Navigate to `/admin`
- [ ] **Stats page works** - Check your personal stats
- [ ] **Mark attendance works** - Try marking a show as attended

### **Common Issues:**

**Issue: "Network Error" or "Failed to fetch"**
- Check that `VITE_API_URL` is set correctly in Vercel
- Check that CORS is configured in backend
- Check Railway logs for errors

**Issue: "Access Denied" in admin panel**
- Make sure your user has `is_admin = true` in Supabase
- Log out and log back in

**Issue: Images not loading**
- Check Supabase Storage permissions
- Verify image URLs are correct

---

## 🎉 Success!

Your application is now live at:
- **Frontend**: `https://blueskiesbase.vercel.app`
- **Backend**: `https://blueskiesbase-production.up.railway.app`

---

## 📝 Post-Deployment

### **Set Up Custom Domain (Optional)**

**Vercel:**
1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `blueskiesbase.com`)
3. Follow DNS configuration instructions

**Railway:**
1. Go to Settings → Domains
2. Add custom domain for API (e.g., `api.blueskiesbase.com`)

### **Enable Auto-Deploy**

Both Vercel and Railway auto-deploy when you push to GitHub:

```powershell
# Make changes
git add .
git commit -m "Add new feature"
git push

# Vercel and Railway will automatically deploy!
```

### **Monitor Your App**

- **Railway**: View logs in Railway dashboard
- **Vercel**: View deployment logs in Vercel dashboard
- **Supabase**: Monitor database usage in Supabase dashboard

---

## 🔒 Security Checklist

- [ ] Environment variables are set (not hardcoded)
- [ ] `.env` files are in `.gitignore`
- [ ] Service role key is only used in backend
- [ ] Anon key is used in frontend
- [ ] CORS is configured properly
- [ ] Admin users are set correctly in database
- [ ] Row Level Security policies are enabled

---

## 💰 Cost Breakdown (Free Tier)

| Service | Free Tier Limits | Upgrade Cost |
|---------|------------------|--------------|
| **Supabase** | 500MB database, 1GB file storage, 50,000 monthly active users | $25/month |
| **Railway** | $5 free credit/month (~500 hours) | $5/month + usage |
| **Vercel** | 100GB bandwidth, unlimited deployments | $20/month |

**Total**: **FREE** for small-medium traffic!

---

## 📞 Need Help?

- **Railway Docs**: https://docs.railway.app
- **Vercel Docs**: https://vercel.com/docs
- **Supabase Docs**: https://supabase.com/docs

---

**You're all set! 🎸**


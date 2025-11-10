# ✅ Pre-Deployment Checklist

Complete this checklist before deploying to production.

---

## 🔒 Security

- [ ] `.env` files are in `.gitignore` (already done ✅)
- [ ] No API keys or secrets in code
- [ ] Admin user is set correctly in database (`info@daniellevy.me`)
- [ ] Row Level Security policies are enabled in Supabase
- [ ] CORS will be configured for production domains

---

## 📁 Code Quality

- [ ] All features tested locally
- [ ] No console errors in browser
- [ ] Backend server runs without errors
- [ ] All API endpoints working
- [ ] Search functionality works
- [ ] Login/signup works
- [ ] Admin panel accessible
- [ ] Stats page displays correctly

---

## 🗄️ Database

- [ ] Supabase project is active
- [ ] All tables created (profiles, venues, shows, songs, setlist_songs, user_shows, user_recordings)
- [ ] 443 shows imported from setlist.fm
- [ ] Admin user has `is_admin = true`
- [ ] Sample data is present (if desired)

---

## 📝 Documentation

- [ ] README.md updated
- [ ] DEPLOYMENT_GUIDE.md created ✅
- [ ] GITHUB_DEPLOYMENT_QUICKSTART.md created ✅
- [ ] Environment variable examples created ✅

---

## 🔑 Environment Variables Ready

### **Backend (.env)**
- [ ] `PORT=3000`
- [ ] `SUPABASE_URL` (from Supabase dashboard)
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (from Supabase dashboard)
- [ ] `NODE_ENV=production` (for production)

### **Frontend (client/.env)**
- [ ] `VITE_SUPABASE_URL` (from Supabase dashboard)
- [ ] `VITE_SUPABASE_ANON_KEY` (from Supabase dashboard)
- [ ] `VITE_API_URL` (will be Railway URL in production)

---

## 🧪 Local Testing

Run these tests before deploying:

### **1. Backend Test**
```powershell
npm run dev
```
- [ ] Server starts on port 3000
- [ ] No errors in console
- [ ] Visit http://localhost:3000/api/shows
- [ ] Should return JSON data

### **2. Frontend Test**
```powershell
cd client
npm run dev
```
- [ ] Vite starts on port 5173 or 5174
- [ ] No errors in console
- [ ] Homepage loads
- [ ] Search works
- [ ] Can view show details

### **3. Full Integration Test**
```powershell
npm run dev:all
```
- [ ] Both servers start
- [ ] Search returns results
- [ ] Can click on a show and view setlist
- [ ] Can log in
- [ ] Can access admin panel
- [ ] Can mark show as attended
- [ ] Stats page shows data

---

## 📦 Files to Commit

### **Include:**
- [ ] All `.js`, `.jsx` files
- [ ] All `.css` files
- [ ] `package.json` and `package-lock.json`
- [ ] `client/package.json` and `client/package-lock.json`
- [ ] `.gitignore`
- [ ] `README.md`
- [ ] All documentation files (`.md`)
- [ ] `database/schema.sql`
- [ ] `scripts/` directory

### **Exclude (already in .gitignore):**
- [ ] `node_modules/`
- [ ] `.env` files
- [ ] `client/dist/`
- [ ] `.vscode/`
- [ ] Log files

---

## 🌐 Deployment Platforms

### **Option 1: Railway + Vercel (Recommended)**
- [ ] Railway account created
- [ ] Vercel account created
- [ ] Both connected to GitHub

### **Option 2: Render (All-in-One)**
- [ ] Render account created
- [ ] Connected to GitHub

### **Option 3: Other**
- [ ] Platform chosen
- [ ] Account created
- [ ] Deployment method researched

---

## 🔗 URLs to Update

After deployment, update these:

### **In Code:**
- [ ] `client/src/services/api.js` - Update `API_URL` to use environment variable
- [ ] `app.js` - Update CORS to include production domains

### **In Environment Variables:**
- [ ] Vercel: Set `VITE_API_URL` to Railway backend URL
- [ ] Railway: Set `NODE_ENV=production`

---

## 📊 Post-Deployment Testing

After deploying, test these:

- [ ] Homepage loads at production URL
- [ ] Search works
- [ ] Show detail pages load
- [ ] Login works
- [ ] Admin panel accessible (with admin account)
- [ ] Stats page works
- [ ] Mark attendance works
- [ ] No console errors
- [ ] No network errors
- [ ] Mobile responsive (test on phone)

---

## 🎯 Known Issues to Address

Before deploying, make sure these are resolved:

- [x] Admin default artist changed from "The Black Crowes" to "Johnny Blue Skies"
- [x] All Black Crowes references removed from visible UI
- [x] Admin authorization working correctly
- [x] Profile loading doesn't hang on login
- [ ] API URL configured for production
- [ ] CORS configured for production domains

---

## 📞 Support Resources

Have these ready:

- [ ] Supabase Dashboard URL bookmarked
- [ ] Railway Dashboard URL bookmarked (after signup)
- [ ] Vercel Dashboard URL bookmarked (after signup)
- [ ] GitHub repository URL bookmarked

---

## 🚀 Ready to Deploy?

If all items above are checked, you're ready to:

1. **Push to GitHub** - Follow `GITHUB_DEPLOYMENT_QUICKSTART.md`
2. **Deploy Backend** - Railway setup (10 minutes)
3. **Deploy Frontend** - Vercel setup (10 minutes)
4. **Test Production** - Verify everything works
5. **Celebrate!** 🎉

---

## 📝 Deployment Notes

Use this space to track your deployment:

**GitHub Repository URL:**
```
https://github.com/YOUR_USERNAME/blueskiesbase
```

**Railway Backend URL:**
```
(Will be generated during deployment)
```

**Vercel Frontend URL:**
```
(Will be generated during deployment)
```

**Deployment Date:**
```
(Fill in when deployed)
```

**Admin Login:**
```
Email: info@daniellevy.me
Password: (your password)
```

---

**Good luck with your deployment! 🎸**


# Quick Start: Admin Panel (5 Minutes)

## 🚀 Get Started in 3 Steps

### **Step 1: Create Admin User (2 minutes)**

1. Open Supabase Dashboard: https://supabase.com/dashboard
2. Select your BlueskiesBase project
3. Click **Authentication** → **Users** in left sidebar
4. Click **Add User** button (top right)
5. Click **Create new user**
6. Fill in:
   ```
   Email: your-email@example.com
   Password: YourSecurePassword123
   ☑ Auto Confirm User (check this!)
   ```
7. Click **Create User**

✅ **Done!** Your admin account is ready.

---

### **Step 2: Login to Admin Panel (1 minute)**

1. Make sure your app is running:
   ```bash
   npm run dev:all
   ```

2. Open browser: http://localhost:5174/login

3. Enter your credentials:
   - Email: (the email you just created)
   - Password: (the password you just created)

4. Click **Sign in**

✅ **Done!** You're now in the admin panel.

---

### **Step 3: Edit Your First Show (2 minutes)**

1. Click **Shows** in the navigation menu

2. You'll see a table with 5 sample shows

3. Click **Edit** on any show

4. Try changing:
   - Tour name
   - Notes
   - Source types
   - Has images checkbox

5. Click **Update Show**

6. See your changes in the shows list!

✅ **Done!** You've successfully edited a show.

---

## 🎯 What's Next?

### **Add a New Show:**
1. Click **+ Add New Show**
2. Fill in the form
3. Click **Create Show**

### **Delete a Show:**
1. Click **Delete** on any show
2. Confirm the deletion

### **View a Show:**
1. Click **View** to see the public page
2. Opens in a new tab

---

## 📍 Important URLs

- **Login**: http://localhost:5174/login
- **Admin Dashboard**: http://localhost:5174/admin
- **Manage Shows**: http://localhost:5174/admin/shows
- **Public Site**: http://localhost:5174

---

## 🔐 Your Credentials

Save these somewhere safe:

```
Email: ___________________________
Password: _________________________
```

---

## 💡 Pro Tips

1. **Stay Logged In**: Your session persists across page refreshes
2. **Sign Out**: Click the red "Sign Out" button in the header
3. **View Site**: Click "View Site" to see the public interface
4. **Edit Anytime**: You can edit shows as many times as you want

---

## 🐛 Having Issues?

### **Can't create user in Supabase?**
- Make sure you're in the correct project
- Check that you clicked "Auto Confirm User"

### **Can't log in?**
- Double-check your email and password
- Make sure the user was created successfully
- Check browser console for errors (F12)

### **Don't see any shows?**
- Make sure backend is running (npm run dev:all)
- Check: http://localhost:3000/api/shows
- You should see JSON data

---

## ✅ Checklist

- [ ] Created admin user in Supabase
- [ ] Logged in to admin panel
- [ ] Viewed the shows list
- [ ] Edited a show
- [ ] Saved the changes
- [ ] Verified the changes appear

---

## 🎉 You're Ready!

You now have full admin access to manage your setlist database!

For more details, see:
- **ADMIN_PANEL_COMPLETE.md** - Full feature list
- **ADMIN_PANEL_SETUP.md** - Detailed setup guide

**Happy managing!** 🎸


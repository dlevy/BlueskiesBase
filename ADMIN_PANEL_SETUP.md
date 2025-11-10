# Admin Panel Setup Guide

## 🎉 Admin Panel is Ready!

Your BlueskiesBase admin panel has been created with full authentication and show management capabilities!

---

## 🔐 Step 1: Enable Email Authentication in Supabase

Before you can log in, you need to enable email authentication in Supabase:

### **1. Go to Supabase Dashboard**
- Visit: https://supabase.com/dashboard
- Select your BlueskiesBase project

### **2. Enable Email Auth**
- Click **Authentication** in the left sidebar
- Click **Providers**
- Make sure **Email** is enabled (it should be by default)

### **3. Disable Email Confirmation (for testing)**
For easier testing, you can disable email confirmation:
- Click **Authentication** → **Settings**
- Scroll to **Email Auth**
- **Uncheck** "Enable email confirmations"
- Click **Save**

---

## 👤 Step 2: Create an Admin User

### **Option A: Using Supabase Dashboard (Recommended)**

1. Go to **Authentication** → **Users** in Supabase Dashboard
2. Click **Add User** → **Create new user**
3. Enter:
   - **Email**: your-email@example.com (use your real email)
   - **Password**: Choose a secure password
   - **Auto Confirm User**: Check this box
4. Click **Create User**

### **Option B: Using the Login Page**

1. Go to http://localhost:5174/login
2. Try to sign in with any email/password
3. If you get an error, the user doesn't exist yet
4. Use Option A to create the user first

---

## 🚀 Step 3: Access the Admin Panel

### **1. Login**
- Go to: http://localhost:5174/login
- Enter your email and password
- Click **Sign in**

### **2. You'll be redirected to:**
http://localhost:5174/admin

### **3. You should see:**
- Admin Dashboard with three cards:
  - 🎸 Shows
  - 🎵 Songs  
  - 🏛️ Venues
- Quick action buttons to add new items

---

## ✨ What You Can Do Now

### **Manage Shows**
1. Click **Shows** or **Manage Shows**
2. See a list of all shows in a table
3. **Actions available:**
   - **View** - Opens show detail page in new tab
   - **Edit** - Edit show information
   - **Delete** - Remove show (with confirmation)
   - **+ Add New Show** - Create a new show

### **Add a New Show**
1. Click **+ Add New Show**
2. Fill in the form:
   - **Show Date** (required)
   - **Artist Name** (required)
   - **Venue** (required - select from dropdown)
   - **Tour Name** (optional)
   - **Notes** (optional)
   - **Source Types** (check all that apply)
   - **Has Images** (checkbox)
3. Click **Create Show**

### **Edit an Existing Show**
1. Go to **Shows** list
2. Click **Edit** on any show
3. Modify the fields
4. Click **Update Show**

### **Delete a Show**
1. Go to **Shows** list
2. Click **Delete** on any show
3. Confirm the deletion

---

## 📁 Admin Panel Structure

### **Routes:**
- `/login` - Login page
- `/admin` - Admin dashboard (protected)
- `/admin/shows` - List all shows (protected)
- `/admin/shows/new` - Add new show (protected)
- `/admin/shows/edit/:id` - Edit show (protected)

### **Components Created:**
- `AuthContext.jsx` - Authentication state management
- `ProtectedRoute.jsx` - Route protection component
- `LoginPage.jsx` - Login form
- `AdminLayout.jsx` - Admin panel layout with navigation
- `AdminDashboard.jsx` - Admin home page
- `ShowsList.jsx` - Show management table
- `ShowForm.jsx` - Add/edit show form

---

## 🔒 Security Features

### **Authentication**
- ✅ Supabase Auth integration
- ✅ Protected routes (redirects to login if not authenticated)
- ✅ Session management
- ✅ Sign out functionality

### **Route Protection**
- All `/admin/*` routes require authentication
- Unauthenticated users are redirected to `/login`
- After login, users are redirected back to the page they tried to access

### **User Session**
- User email displayed in admin header
- Sign out button in header
- Session persists across page refreshes

---

## 🎨 Admin Panel Features

### **Navigation**
- **Dashboard** - Overview and quick actions
- **Shows** - Manage concert shows
- **Songs** - Manage song catalog (coming soon)
- **Venues** - Manage venues (coming soon)
- **View Site** - Return to public site
- **Sign Out** - Log out

### **Show Management**
- ✅ List all shows with pagination
- ✅ View show details
- ✅ Add new shows
- ✅ Edit existing shows
- ✅ Delete shows
- ✅ Select venue from dropdown
- ✅ Multiple source types
- ✅ Tour information
- ✅ Show notes

---

## 🧪 Testing the Admin Panel

### **Test Login:**
1. Go to http://localhost:5174/login
2. Enter your credentials
3. Should redirect to admin dashboard

### **Test Protected Routes:**
1. Sign out
2. Try to access http://localhost:5174/admin
3. Should redirect to login page
4. After login, should return to admin page

### **Test Show Management:**
1. Go to **Shows**
2. Click **Edit** on an existing show
3. Change the tour name
4. Click **Update Show**
5. Verify the change in the shows list

### **Test Add Show:**
1. Click **+ Add New Show**
2. Fill in all required fields
3. Click **Create Show**
4. Verify new show appears in list

---

## 📝 Next Steps

### **Completed:**
- ✅ Authentication system
- ✅ Protected routes
- ✅ Admin layout and navigation
- ✅ Show management (list, add, edit, delete)

### **Coming Soon:**
- [ ] Song management pages
- [ ] Venue management pages
- [ ] Setlist editor (add/edit songs in setlist)
- [ ] Image upload functionality
- [ ] User management
- [ ] Statistics and analytics

---

## 🐛 Troubleshooting

### **Can't log in?**
- Make sure you created a user in Supabase Dashboard
- Check that email confirmation is disabled (for testing)
- Check browser console for errors
- Verify Supabase credentials in `client/.env`

### **Redirected to login immediately?**
- This is normal if you're not logged in
- Sign in with your credentials
- Session should persist after login

### **Changes not saving?**
- Check browser console for errors
- Verify backend is running on port 3000
- Check Supabase connection

### **Venues dropdown is empty?**
- Make sure you have venues in the database
- Check that sample data was loaded
- Verify API endpoint: http://localhost:3000/api/venues

---

## 🎯 Quick Reference

### **URLs:**
- Public Site: http://localhost:5174
- Login: http://localhost:5174/login
- Admin Dashboard: http://localhost:5174/admin
- Manage Shows: http://localhost:5174/admin/shows
- Add Show: http://localhost:5174/admin/shows/new

### **Test Credentials:**
Use the email and password you created in Supabase Dashboard

### **API Endpoints Used:**
- `GET /api/shows` - List shows
- `GET /api/shows/:id` - Get show details
- `POST /api/shows` - Create show
- `PUT /api/shows/:id` - Update show
- `DELETE /api/shows/:id` - Delete show
- `GET /api/venues` - List venues

---

## 🎉 Congratulations!

You now have a fully functional admin panel with:
- ✅ Secure authentication
- ✅ Protected admin routes
- ✅ Show management interface
- ✅ Add, edit, and delete shows
- ✅ Professional UI

**Ready to manage your setlist database!** 🎸


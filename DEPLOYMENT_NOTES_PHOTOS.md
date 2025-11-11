# Deployment Guide: Notes & Photos Feature

## ⚠️ IMPORTANT: Database Migration Required

Before the feature will work, you **MUST** run the database migration in Supabase.

---

## Step 1: Run Database Migration

### **1.1 Open Supabase SQL Editor**
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `blueskiesbase`
3. Click **SQL Editor** in the left sidebar

### **1.2 Run Migration Script**
1. Open the file: `database/migration_user_notes_photos.sql`
2. Copy the **entire contents** of the file
3. Paste into the SQL Editor
4. Click **Run** (or press Ctrl+Enter)

### **1.3 Verify Migration Success**
You should see output like:
```
Migration completed successfully!
Created tables:
  - user_notes (with RLS policies)
  - user_photos (with RLS policies)
Created storage bucket:
  - show-photos (public, with storage policies)
Created triggers:
  - update_user_notes_updated_at
  - update_user_photos_updated_at
```

### **1.4 Verify Tables Created**
1. Click **Table Editor** in left sidebar
2. You should see two new tables:
   - `user_notes`
   - `user_photos`

### **1.5 Verify Storage Bucket Created**
1. Click **Storage** in left sidebar
2. You should see a bucket named: `show-photos`
3. Click on it and verify it's set to **Public**

---

## Step 2: Verify Backend Deployment

### **2.1 Check Railway Deployment**
1. Go to Railway Dashboard: https://railway.app
2. Select your project: `blueskiesbase-production`
3. Check that the latest deployment is running
4. Look for commit: `Feature: Add user notes and photos...`

### **2.2 If Not Auto-Deployed**
If Railway didn't auto-deploy:
1. Click **Deploy** button
2. Select **Redeploy**
3. Wait for deployment to complete (~2-3 minutes)

### **2.3 Test Backend Endpoints**
Open these URLs in your browser to verify:

**Test Notes API:**
```
https://blueskiesbase-production.up.railway.app/api/notes/show/{any-show-id}
```
Should return: `{ "notes": [] }`

**Test Photos API:**
```
https://blueskiesbase-production.up.railway.app/api/photos/show/{any-show-id}
```
Should return: `{ "photos": [] }`

---

## Step 3: Verify Frontend Deployment

### **3.1 Check Vercel Deployment**
1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select your project: `blueskies-base`
3. Check that the latest deployment is running
4. Look for commit: `Feature: Add user notes and photos...`

### **3.2 If Not Auto-Deployed**
If Vercel didn't auto-deploy:
1. Click **Redeploy** button
2. Wait for deployment to complete (~1-2 minutes)

---

## Step 4: Test the Feature

### **4.1 Test as Regular User**

1. **Go to the app**: https://blueskies-base.vercel.app
2. **Sign in** with your account
3. **Go to any setlist** (click on a show from search results)
4. **Scroll down** - you should see two new sections:
   - **Notes** section
   - **Photos** section

5. **Test Notes:**
   - Click "Add Your Note"
   - Type some text
   - Click "Save Note"
   - Note should appear immediately
   - Click "Edit" to modify
   - Click "Delete" to remove

6. **Test Photos:**
   - Click "Upload Photo"
   - Select an image file (< 5MB)
   - Add a caption (optional)
   - Click "Upload"
   - Photo should appear immediately
   - Click photo to open lightbox
   - Use arrow keys or click arrows to navigate
   - Press ESC to close lightbox
   - Click "Delete" to remove photo

### **4.2 Test as Admin**

1. **Sign in** as admin (info@daniellevy.me)
2. **Go to any setlist** with user notes/photos
3. **Verify admin features:**
   - You should see "Delete" button on ALL notes (not just yours)
   - You should see "Delete" button on ALL photos (not just yours)
   - Click "Delete" on another user's note - should work
   - Click "Delete" on another user's photo - should work

---

## Step 5: Troubleshooting

### **Problem: "Failed to fetch notes" error**

**Solution:**
1. Check that database migration ran successfully
2. Verify `user_notes` table exists in Supabase
3. Check RLS policies are in place
4. Check browser console for detailed error

### **Problem: "Failed to upload photo" error**

**Possible causes:**
1. **Storage bucket doesn't exist**
   - Go to Supabase → Storage
   - Verify `show-photos` bucket exists
   - Verify it's set to Public

2. **File too large**
   - Max file size is 5MB
   - Try a smaller image

3. **Not an image file**
   - Only image files are allowed
   - Try a .jpg, .png, or .gif file

4. **Storage policies missing**
   - Re-run the migration script
   - Check storage policies in Supabase

### **Problem: Photos not displaying**

**Solution:**
1. Check that photo uploaded successfully (check database)
2. Verify storage bucket is Public
3. Check photo URL in database is accessible
4. Check browser console for errors

### **Problem: Lightbox not working**

**Solution:**
1. Verify `yet-another-react-lightbox` is installed
2. Hard refresh browser (Ctrl+Shift+R)
3. Check browser console for errors
4. Verify Vercel deployed latest code

### **Problem: Can't delete other users' content as admin**

**Solution:**
1. Verify you're signed in as admin
2. Check `is_admin = true` in profiles table
3. Check RLS policies allow admin delete
4. Check browser console for errors

---

## Step 6: Verify Everything Works

### **Checklist:**

- [ ] Database migration ran successfully
- [ ] `user_notes` table exists
- [ ] `user_photos` table exists
- [ ] `show-photos` storage bucket exists and is Public
- [ ] Railway backend deployed latest code
- [ ] Vercel frontend deployed latest code
- [ ] Can view notes section on setlist page
- [ ] Can view photos section on setlist page
- [ ] Can add a note (signed in)
- [ ] Can edit your note
- [ ] Can delete your note
- [ ] Can upload a photo (signed in)
- [ ] Can view photo in lightbox
- [ ] Can navigate photos in lightbox
- [ ] Can delete your photo
- [ ] Admin can delete any note
- [ ] Admin can delete any photo

---

## Summary

### **What Was Added:**

**Database:**
- ✅ `user_notes` table
- ✅ `user_photos` table
- ✅ `show-photos` storage bucket
- ✅ RLS policies for security
- ✅ Storage policies for file access

**Backend:**
- ✅ `/api/notes` routes (4 endpoints)
- ✅ `/api/photos` routes (4 endpoints)
- ✅ File upload handling with multer
- ✅ Admin authorization checks

**Frontend:**
- ✅ `NotesSection` component
- ✅ `PhotosSection` component
- ✅ Lightbox photo viewer
- ✅ Thumbnail navigation
- ✅ Upload form with validation
- ✅ Admin moderation UI

**Dependencies:**
- ✅ `multer` (backend - file uploads)
- ✅ `yet-another-react-lightbox` (frontend - photo viewer)

---

## Next Steps After Deployment

1. **Test thoroughly** with multiple users
2. **Monitor storage usage** in Supabase (photos take up space)
3. **Consider adding**:
   - Photo compression before upload
   - Image optimization
   - Pagination for large photo collections
   - Moderation queue for admin review

---

## Storage Considerations

### **Supabase Free Tier:**
- **Storage**: 1GB included
- **Bandwidth**: 2GB/month included

### **Estimate:**
- Average photo: ~2MB
- 1GB = ~500 photos
- Monitor usage in Supabase Dashboard → Settings → Usage

### **If You Exceed Limits:**
- Upgrade to Supabase Pro ($25/month)
- Or implement photo compression
- Or limit photos per user/show

---

## Support

If you encounter any issues:

1. **Check browser console** for errors
2. **Check Railway logs** for backend errors
3. **Check Supabase logs** for database errors
4. **Verify all steps** in this guide were completed

---

**The feature is ready to deploy! Follow the steps above to make it live.** 🚀


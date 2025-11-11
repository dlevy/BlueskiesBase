# User Notes and Photos Feature

## Overview

This feature allows signed-in users to add personal notes and upload photos to any setlist. Notes and photos are displayed on the setlist detail page for all users to see. Admins have the ability to moderate (edit/delete) any user's notes and photos.

---

## Database Schema

### **user_notes** table
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to profiles)
- show_id (UUID, foreign key to shows)
- note_text (TEXT, required)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE constraint on (user_id, show_id) - one note per user per show
```

### **user_photos** table
```sql
- id (UUID, primary key)
- user_id (UUID, foreign key to profiles)
- show_id (UUID, foreign key to shows)
- photo_url (TEXT, required) - URL to photo in Supabase Storage
- caption (TEXT, optional)
- display_order (INTEGER) - order to display photos
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### **Storage Bucket**
- **Bucket name**: `show-photos`
- **Public**: Yes (anyone can view)
- **File structure**: `{user_id}/{show_id}/{timestamp}.{ext}`
- **Max file size**: 5MB
- **Allowed types**: Images only (jpg, png, gif, webp, etc.)

---

## Row Level Security (RLS) Policies

### **user_notes**
- ✅ **SELECT**: Everyone can view all notes
- ✅ **INSERT**: Users can create their own notes
- ✅ **UPDATE**: Users can update their own notes, admins can update any note
- ✅ **DELETE**: Users can delete their own notes, admins can delete any note

### **user_photos**
- ✅ **SELECT**: Everyone can view all photos
- ✅ **INSERT**: Users can upload their own photos
- ✅ **UPDATE**: Users can update their own photos, admins can update any photo
- ✅ **DELETE**: Users can delete their own photos, admins can delete any photo

### **Storage (show-photos bucket)**
- ✅ **SELECT**: Anyone can view photos
- ✅ **INSERT**: Authenticated users can upload photos
- ✅ **UPDATE**: Users can update their own photos
- ✅ **DELETE**: Users can delete their own photos, admins can delete any photo

---

## Backend API Endpoints

### **Notes API** (`/api/notes`)

#### `GET /api/notes/show/:showId`
Get all notes for a specific show
- **Auth**: Not required
- **Returns**: `{ notes: [...] }` with user profile info

#### `GET /api/notes/user/:showId`
Get the authenticated user's note for a specific show
- **Auth**: Required
- **Returns**: `{ note: {...} }` or `{ note: null }`

#### `POST /api/notes`
Create or update a note
- **Auth**: Required
- **Body**: `{ show_id, note_text }`
- **Returns**: `{ note: {...} }`
- **Note**: If note exists, it updates; otherwise creates new

#### `DELETE /api/notes/:noteId`
Delete a note
- **Auth**: Required
- **Authorization**: User must own the note OR be admin
- **Returns**: `{ success: true }`

---

### **Photos API** (`/api/photos`)

#### `GET /api/photos/show/:showId`
Get all photos for a specific show
- **Auth**: Not required
- **Returns**: `{ photos: [...] }` ordered by display_order, then created_at

#### `POST /api/photos/upload`
Upload a photo
- **Auth**: Required
- **Body**: FormData with `photo` (file), `show_id`, `caption` (optional)
- **Returns**: `{ photo: {...} }`
- **Validation**: 
  - Max 5MB file size
  - Images only
  - Uploads to `show-photos/{user_id}/{show_id}/{timestamp}.{ext}`

#### `PUT /api/photos/:photoId`
Update photo caption
- **Auth**: Required
- **Authorization**: User must own the photo OR be admin
- **Body**: `{ caption }`
- **Returns**: `{ photo: {...} }`

#### `DELETE /api/photos/:photoId`
Delete a photo
- **Auth**: Required
- **Authorization**: User must own the photo OR be admin
- **Returns**: `{ success: true }`
- **Note**: Deletes both database record and file from storage

---

## Frontend Components

### **NotesSection** (`client/src/components/NotesSection.jsx`)

**Features:**
- ✅ Display all community notes for a show
- ✅ Signed-in users can add/edit their own note (one per show)
- ✅ Users can delete their own notes
- ✅ Admins can delete any note
- ✅ Real-time updates after save/delete
- ✅ Error handling and loading states

**UI:**
- User's note section (highlighted in blue border)
- Community notes section (all notes from all users)
- Add/Edit/Delete buttons
- Username and date display
- Admin delete button on all notes

---

### **PhotosSection** (`client/src/components/PhotosSection.jsx`)

**Features:**
- ✅ Display photos one at a time (carousel style)
- ✅ Click photo to open lightbox viewer
- ✅ Lightbox allows scrolling through all photos
- ✅ Thumbnail navigation below main photo
- ✅ Upload photos with optional caption
- ✅ Users can delete their own photos
- ✅ Admins can delete any photo
- ✅ File validation (5MB max, images only)

**UI:**
- Main photo display (large, clickable)
- Photo counter (e.g., "Photo 1 of 5")
- Thumbnail strip for navigation
- Upload form (hidden until "Upload Photo" clicked)
- Caption and uploader info
- Delete button for owners/admins

**Lightbox:**
- Full-screen photo viewer
- Keyboard navigation (arrow keys)
- Swipe navigation (mobile)
- Close button (ESC key or click outside)
- Photo counter and navigation

---

## User Experience

### **For Regular Users:**

1. **View Notes/Photos**:
   - Go to any setlist detail page
   - Scroll down to see Notes and Photos sections
   - No login required to view

2. **Add a Note**:
   - Sign in
   - Go to setlist detail page
   - Click "Add Your Note" button
   - Type your note (memories, highlights, etc.)
   - Click "Save Note"
   - Note appears immediately

3. **Edit Your Note**:
   - Click "Edit" button on your note
   - Modify text
   - Click "Save Note"

4. **Delete Your Note**:
   - Click "Delete" button on your note
   - Confirm deletion

5. **Upload a Photo**:
   - Sign in
   - Go to setlist detail page
   - Click "Upload Photo" button
   - Select image file (max 5MB)
   - Add optional caption
   - Click "Upload"
   - Photo appears immediately

6. **View Photos**:
   - Click main photo to open lightbox
   - Use arrow keys or click arrows to navigate
   - Press ESC or click outside to close
   - Click thumbnails to jump to specific photo

7. **Delete Your Photo**:
   - Click "Delete" button on your photo
   - Confirm deletion

---

### **For Admins:**

**All regular user features PLUS:**

1. **Delete Any Note**:
   - See "Delete" button on all notes (not just your own)
   - Click to delete inappropriate content
   - No confirmation needed

2. **Delete Any Photo**:
   - See "Delete" button on all photos (not just your own)
   - Click to delete inappropriate content
   - Deletes both database record and file from storage

---

## Setup Instructions

### **1. Run Database Migration**

In Supabase SQL Editor, run:
```sql
-- Copy and paste contents of database/migration_user_notes_photos.sql
```

This creates:
- `user_notes` table with RLS policies
- `user_photos` table with RLS policies
- `show-photos` storage bucket with policies
- Triggers for `updated_at` columns

### **2. Verify Storage Bucket**

1. Go to Supabase Dashboard → **Storage**
2. Verify `show-photos` bucket exists
3. Verify it's set to **Public**
4. Check storage policies are in place

### **3. Install Dependencies**

Backend:
```bash
npm install multer
```

Frontend:
```bash
cd client
npm install yet-another-react-lightbox
```

### **4. Deploy**

1. **Commit changes**:
   ```bash
   git add -A
   git commit -m "Feature: Add user notes and photos to setlists"
   git push
   ```

2. **Vercel** will auto-deploy frontend
3. **Railway** will auto-deploy backend (if connected to GitHub)

---

## Testing Checklist

### **Notes:**
- [ ] View notes on setlist page (not logged in)
- [ ] Sign in and add a note
- [ ] Edit your note
- [ ] Delete your note
- [ ] View other users' notes
- [ ] Admin: Delete another user's note

### **Photos:**
- [ ] View photos on setlist page (not logged in)
- [ ] Sign in and upload a photo
- [ ] Upload photo with caption
- [ ] Click photo to open lightbox
- [ ] Navigate photos in lightbox (arrows, keyboard)
- [ ] Click thumbnails to jump to photo
- [ ] Delete your photo
- [ ] Admin: Delete another user's photo
- [ ] Try uploading file > 5MB (should fail)
- [ ] Try uploading non-image file (should fail)

### **Edge Cases:**
- [ ] Upload multiple photos to same show
- [ ] Add note to show with no setlist
- [ ] Delete photo while viewing in lightbox
- [ ] Upload photo with very long caption
- [ ] Add note with special characters/emojis

---

## File Structure

```
database/
  └── migration_user_notes_photos.sql

server/routes/
  ├── notes.js (new)
  └── photos.js (new)

client/src/
  ├── components/
  │   ├── NotesSection.jsx (new)
  │   └── PhotosSection.jsx (new)
  ├── pages/
  │   └── ShowDetailPage.jsx (updated)
  └── services/
      └── api.js (updated with notes/photos functions)

app.js (updated with new routes)
```

---

## Security Considerations

✅ **Authentication**: All write operations require valid JWT token  
✅ **Authorization**: Users can only edit/delete their own content (except admins)  
✅ **File Validation**: Server-side validation for file size and type  
✅ **RLS Policies**: Database-level security prevents unauthorized access  
✅ **Storage Policies**: Supabase Storage policies prevent unauthorized uploads/deletes  
✅ **SQL Injection**: Using parameterized queries via Supabase client  
✅ **XSS Protection**: React automatically escapes user input  

---

## Future Enhancements

- [ ] Photo editing (crop, rotate, filters)
- [ ] Photo likes/reactions
- [ ] Note replies/comments
- [ ] Photo albums/collections
- [ ] Bulk photo upload
- [ ] Photo tagging (people, songs, moments)
- [ ] Export notes as PDF
- [ ] Share photos on social media

---

## Troubleshooting

### **Photos not uploading:**
1. Check storage bucket exists and is public
2. Verify storage policies are in place
3. Check file size < 5MB
4. Check file is an image type
5. Check browser console for errors

### **Notes not saving:**
1. Verify user is logged in
2. Check browser console for errors
3. Verify database tables exist
4. Check RLS policies are in place

### **Lightbox not working:**
1. Verify `yet-another-react-lightbox` is installed
2. Check CSS is imported
3. Check browser console for errors

---

## Summary

✅ **Database**: 2 new tables + storage bucket  
✅ **Backend**: 2 new route files with 8 endpoints  
✅ **Frontend**: 2 new components + updated ShowDetailPage  
✅ **Security**: RLS policies + storage policies  
✅ **UX**: Lightbox viewer + thumbnail navigation  
✅ **Admin**: Full moderation capabilities  

**Users can now share their concert memories with notes and photos!** 🎉


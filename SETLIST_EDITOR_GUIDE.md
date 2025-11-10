# 🎸 Setlist Editor - Complete Guide

## 🎉 Setlist Editor is Ready!

You can now add, edit, reorder, and manage complete setlists for every show!

---

## ✅ What Was Built

### **1. Backend API Endpoints** ✅
- `PUT /api/shows/:id/setlist` - Update entire setlist
- `POST /api/shows/:id/setlist/song` - Add single song
- `DELETE /api/shows/:showId/setlist/:setlistId` - Remove song

### **2. Setlist Editor Component** ✅
- Visual setlist builder with 4 sets (Set 1, Set 2, Set 3, Encore)
- Add songs from your song database
- Reorder songs with up/down arrows
- Remove songs from setlist
- Mark songs as covers
- Add original artist for covers
- Add notes for each song (teases, guests, etc.)

### **3. Integration** ✅
- Integrated into Add Show page
- Integrated into Edit Show page
- Saves setlist along with show details

---

## 🚀 How to Use the Setlist Editor

### **Step 1: Go to Add/Edit Show Page**

**To Add a New Show:**
1. Log in to admin panel: http://localhost:5174/login
2. Go to Shows: http://localhost:5174/admin/shows
3. Click **+ Add New Show**

**To Edit an Existing Show:**
1. Go to Shows list
2. Click **Edit** on any show

---

### **Step 2: Fill in Show Details**

Fill in the basic show information:
- Show Date
- Artist Name
- Venue
- Tour Name (optional)
- Notes (optional)
- Source Types
- Has Images

---

### **Step 3: Build the Setlist**

Scroll down to the **Setlist Editor** section.

#### **Add Songs:**

1. Click **+ Add Song** button
2. A modal will open with:
   - **Set selector** - Choose which set to add to (Set 1, Set 2, Set 3, Encore)
   - **Search box** - Type to search for songs
   - **Song list** - Click any song to add it

3. The song will be added to the selected set

#### **Reorder Songs:**

- Click **↑** to move a song up
- Click **↓** to move a song down
- Songs are automatically numbered

#### **Edit Song Details:**

1. Click the **⚙️** (gear icon) on any song
2. You can:
   - Mark as cover song (checkbox)
   - Add original artist (if cover)
   - Add notes (e.g., "with guest", "teases Remedy")

#### **Remove Songs:**

- Click the **×** button to remove a song from the setlist

---

### **Step 4: Save Everything**

1. Scroll back to the top
2. Click **Create Show** (for new) or **Update Show** (for edit)
3. Both the show details AND the setlist will be saved!

---

## 🎯 Features

### **Visual Setlist Builder**
- 4 separate sets displayed in a grid
- Set 1, Set 2, Set 3, Encore
- Each set shows all songs in order
- Empty sets show "No songs yet"

### **Song Search**
- Search through all songs in your database
- Type to filter by song title
- Shows original artist if it's a cover
- Click to add instantly

### **Song Management**
- ✅ Add songs to any set
- ✅ Reorder songs within a set
- ✅ Remove songs from setlist
- ✅ Mark songs as covers
- ✅ Add original artist for covers
- ✅ Add notes for each song
- ✅ Automatic numbering

### **Cover Song Support**
- Mark any song as a cover
- Add the original artist
- Cover badge displays on song

### **Song Notes**
- Add notes to any song
- Examples:
  - "with guest John Doe"
  - "teases Remedy"
  - "extended jam"
  - "acoustic version"

---

## 📊 Example Workflow

### **Creating a New Show with Setlist:**

1. **Add Show Details:**
   - Date: 2024-12-15
   - Artist: The Black Crowes
   - Venue: Madison Square Garden
   - Tour: Happiness Bastards Tour

2. **Build Set 1:**
   - Click "+ Add Song"
   - Select "Set 1"
   - Search for "Midnight"
   - Click "Midnight from a Dry County"
   - Repeat for more songs

3. **Build Set 2:**
   - Click "+ Add Song"
   - Select "Set 2"
   - Add songs for second set

4. **Add Encore:**
   - Click "+ Add Song"
   - Select "Encore"
   - Add encore songs

5. **Mark a Cover:**
   - Click ⚙️ on a song
   - Check "This is a cover song"
   - Enter original artist

6. **Save:**
   - Click "Create Show"
   - Done! ✅

---

## 🎨 Setlist Editor UI

### **Main View:**
```
┌─────────────────────────────────────────┐
│  Setlist Editor          [+ Add Song]   │
├─────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐      │
│  │   Set 1     │  │   Set 2     │      │
│  ├─────────────┤  ├─────────────┤      │
│  │ 1. Song A   │  │ 1. Song E   │      │
│  │ 2. Song B   │  │ 2. Song F   │      │
│  │ 3. Song C   │  │ 3. Song G   │      │
│  └─────────────┘  └─────────────┘      │
│  ┌─────────────┐  ┌─────────────┐      │
│  │   Set 3     │  │   Encore    │      │
│  ├─────────────┤  ├─────────────┤      │
│  │ 1. Song H   │  │ 1. Song K   │      │
│  │ 2. Song I   │  │ 2. Song L   │      │
│  └─────────────┘  └─────────────┘      │
└─────────────────────────────────────────┘
```

### **Song Item:**
```
┌────────────────────────────────────────┐
│ 1. Song Title [Cover] ⚙️ ↑ ↓ ×        │
│ ┌──────────────────────────────────┐  │
│ │ ☑ This is a cover song           │  │
│ │ Original artist: [____________]  │  │
│ │ Notes: [_____________________]   │  │
│ └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```

---

## 🧪 Testing the Setlist Editor

### **Test 1: Add Songs to a Show**
1. Go to http://localhost:5174/admin/shows
2. Click **Edit** on any show
3. Scroll to Setlist Editor
4. Click **+ Add Song**
5. Search for a song
6. Click to add it
7. Verify it appears in the set
8. Click **Update Show**
9. Refresh the page
10. Verify the song is still there ✅

### **Test 2: Reorder Songs**
1. Add multiple songs to Set 1
2. Click ↑ on the second song
3. Verify it moves up
4. Click ↓ on the first song
5. Verify it moves down
6. Save and verify order persists ✅

### **Test 3: Mark as Cover**
1. Click ⚙️ on a song
2. Check "This is a cover song"
3. Enter original artist
4. Verify "Cover" badge appears
5. Save and verify it persists ✅

### **Test 4: Add Notes**
1. Click ⚙️ on a song
2. Enter notes: "with guest"
3. Save
4. View the show on public site
5. Verify notes appear ✅

### **Test 5: Remove Songs**
1. Click × on a song
2. Verify it's removed
3. Save
4. Verify it's gone ✅

---

## 💡 Pro Tips

### **Building Setlists Efficiently:**
1. Add all Set 1 songs first
2. Then Set 2, Set 3, Encore
3. Use search to find songs quickly
4. Mark covers as you go
5. Add notes for special moments

### **Organizing Sets:**
- Use Set 1, Set 2, Set 3 for main sets
- Use Encore for encore songs
- Songs are automatically numbered
- Reorder anytime with arrows

### **Cover Songs:**
- Always mark covers with the checkbox
- Add original artist for reference
- Cover badge helps identify them

### **Song Notes:**
- Use for special moments
- Examples:
  - "with guest [name]"
  - "teases [song]"
  - "extended jam"
  - "acoustic"
  - "first time played"

---

## 🔧 Technical Details

### **Data Flow:**
1. User adds/edits songs in SetlistEditor component
2. SetlistEditor calls `onChange` with updated setlist
3. ShowForm stores setlist in state
4. On submit, ShowForm saves show details first
5. Then saves setlist with `updateSetlist` API call
6. Backend deletes old setlist and inserts new one

### **API Format:**
```javascript
[
  {
    song_id: "uuid",
    set_number: 1,
    song_order: 1,
    is_encore: false,
    notes: "with guest",
    is_cover: true,
    original_artist: "Led Zeppelin"
  },
  // ... more songs
]
```

### **Database:**
- Table: `setlist_songs`
- Links shows to songs
- Stores order, set number, notes
- Cascade delete when show is deleted

---

## 📝 What You Can Do Now

### **✅ Completed:**
1. Add songs to any set
2. Reorder songs within sets
3. Remove songs from setlist
4. Mark songs as covers
5. Add original artist for covers
6. Add notes to songs
7. Save complete setlists
8. Edit existing setlists
9. View setlists on public site

### **🔜 Future Enhancements:**
- Drag-and-drop reordering
- Copy setlist from another show
- Setlist templates
- Bulk add songs
- Song statistics
- Most played songs

---

## 🎉 Success!

You now have a complete setlist editor! You can:
- ✅ Build complete setlists for every show
- ✅ Add songs from your database
- ✅ Reorder songs easily
- ✅ Mark covers and add notes
- ✅ Save everything together

**Your setlist database is fully functional!** 🎸

---

## 🚀 Next Steps

1. **Edit existing shows** - Add setlists to your 5 sample shows
2. **Add new shows** - Create shows with complete setlists
3. **View on public site** - See your setlists displayed beautifully

Then we can build:
- Song management pages
- Venue management pages
- Statistics and analytics
- And more!

**Happy setlist building!** 🎵


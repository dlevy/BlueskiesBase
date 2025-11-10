# 🎸 Johnny Blue Skies / Sturgill Simpson - Important Notes

## Artist Information

**Johnny Blue Skies** is the stage name used by **Sturgill Simpson** starting in 2024.

---

## setlist.fm Integration

### **How It Works:**

On setlist.fm, all shows are listed under **"Sturgill Simpson"** - including:
- ✅ Early Sturgill Simpson shows (2012-2021)
- ✅ Recent Sturgill Simpson shows (2022-2024)
- ✅ **Johnny Blue Skies shows (2024-2025)**

### **MusicBrainz ID:**
- **Sturgill Simpson:** `f6e61750-a6b7-4d88-979b-052345cd0e4a`
- This ID covers all shows, including Johnny Blue Skies performances

### **Total Setlists Available:**
As of November 2025: **443 setlists**

---

## Import Strategy

### **Recommended Approach:**

```powershell
# Import all Sturgill Simpson / Johnny Blue Skies setlists
python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 500
```

This will import:
- 📅 **2012-2021:** Early Sturgill Simpson shows
- 📅 **2022-2024:** Recent Sturgill Simpson shows  
- 📅 **2024-2025:** Johnny Blue Skies tour shows

### **What Gets Imported:**

#### **Johnny Blue Skies Songs:**
The import will automatically detect and import Johnny Blue Skies songs:
- ✅ "One for the Road"
- ✅ "Right Kind of Dream"
- ✅ "Jupiter's Faerie"
- ✅ "Mint Tea"
- ✅ "If the Sun Never Rises Again"
- ✅ "Scooter Blues"
- ✅ "Who I Am"
- And more!

#### **Sturgill Simpson Songs:**
Classic Sturgill songs will also be imported:
- ✅ "Turtles All the Way Down"
- ✅ "Living the Dream"
- ✅ "It Ain't All Flowers"
- ✅ "Long White Line"
- ✅ "Brace for Impact (Live a Little)"
- And many more!

#### **Cover Songs:**
The script automatically detects covers:
- ✅ "The Promise" (When in Rome cover)
- ✅ "You Don't Miss Your Water" (William Bell cover)
- ✅ "In Bloom" (Nirvana cover)
- ✅ "Purple Rain" (Prince cover)
- ✅ "A Whiter Shade of Pale" (Procol Harum cover)
- And 50+ more covers!

---

## Tour Information

### **Recent Tours Included:**

1. **"Who the F**k Is Johnny Blue Skies?" Tour (2024-2025)**
   - 33 shows as of Nov 2025
   - Johnny Blue Skies material
   - Mix of new and classic songs

2. **"Why Not?" Tour (2024)**
   - 55 shows
   - Transition period

3. **"A Good Look'n Tour" (2024-2025)**
   - 12 shows
   - Recent performances

4. **"A Sailor's Guide to Earth" Tour (2016-2018)**
   - 67 shows
   - Classic era

5. **Earlier Tours (2012-2016)**
   - 200+ shows
   - Early career

---

## Database Structure

### **How It Will Be Stored:**

After import, your database will have:

#### **Artist Entry:**
```
Name: Sturgill Simpson
MusicBrainz ID: f6e61750-a6b7-4d88-979b-052345cd0e4a
```

#### **Shows:**
Each show will have:
- Artist name: "Sturgill Simpson" (from setlist.fm)
- Tour name: "Who the F**k Is Johnny Blue Skies?" (for recent shows)
- Complete setlist with song order
- Venue with coordinates
- Show date

#### **Songs:**
Songs will be tagged with:
- Title (e.g., "One for the Road")
- Whether it's a cover
- Original artist (if cover)
- MusicBrainz ID (when available)

---

## Customization After Import

### **Option 1: Keep As-Is**
- Leave artist as "Sturgill Simpson"
- Tour names will distinguish eras
- Songs are properly attributed

### **Option 2: Update Artist Name**
You can manually update recent shows in the admin panel:
1. Go to http://localhost:5174/admin/shows
2. Filter by tour: "Who the F**k Is Johnny Blue Skies?"
3. Edit shows to change artist name to "Johnny Blue Skies"

### **Option 3: Add Artist Aliases**
Future enhancement: Add an "aliases" field to artists table
- Primary: "Sturgill Simpson"
- Alias: "Johnny Blue Skies"
- Display based on show date or tour

---

## Song Attribution

### **Johnny Blue Skies Songs:**

The following songs are marked as "Johnny Blue Skies song" on setlist.fm:
- One for the Road
- Right Kind of Dream
- Jupiter's Faerie
- Mint Tea
- If the Sun Never Rises Again
- Scooter Blues
- Who I Am

These will be imported with proper attribution.

### **Sturgill Simpson Songs:**

Classic Sturgill songs will be imported as original Sturgill Simpson material.

---

## Venue Data

### **Geographic Coverage:**

Sturgill Simpson / Johnny Blue Skies has performed at venues across:
- 🇺🇸 United States (majority)
- 🇨🇦 Canada
- 🇬🇧 United Kingdom
- 🇪🇺 Europe
- 🇦🇺 Australia

All venues will be imported with:
- ✅ Full address (city, state, country)
- ✅ Geographic coordinates (lat/long)
- ✅ Country codes
- ✅ Links to setlist.fm

---

## Statistics

### **What You'll Get:**

After importing all 443 setlists:

- **~443 shows** spanning 2012-2025
- **~130+ unique songs** (originals + covers)
- **~100+ venues** worldwide
- **~50+ cover songs** from various artists
- **Complete setlists** with song order and set numbers

---

## Example Setlist

### **Recent Johnny Blue Skies Show:**

**Date:** February 15, 2025  
**Venue:** Ryman Auditorium, Nashville, TN  
**Tour:** Who the F**k Is Johnny Blue Skies?

**Set 1:**
1. It Ain't All Flowers
2. One for the Road (Johnny Blue Skies)
3. Turtles All the Way Down
4. Right Kind of Dream (Johnny Blue Skies)
5. Long White Line (cover)
6. Jupiter's Faerie (Johnny Blue Skies)
7. Living the Dream
8. Mint Tea (Johnny Blue Skies)
9. Brace for Impact (Live a Little)
10. If the Sun Never Rises Again (Johnny Blue Skies)

**Set 2:**
1. Welcome to Earth (Pollywog)
2. Scooter Blues (Johnny Blue Skies)
3. Life of Sin
4. The Promise (When in Rome cover)
5. Call to Arms
6. In Bloom (Nirvana cover)
7. Railroad of Sin

**Encore:**
1. Purple Rain (Prince cover)
2. A Whiter Shade of Pale (Procol Harum cover)

---

## Tips

### **For Best Results:**

1. **Import All Shows:**
   ```powershell
   python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 500
   ```

2. **Filter by Tour:**
   - Use admin panel to filter by tour name
   - "Who the F**k Is Johnny Blue Skies?" = recent shows
   - "A Sailor's Guide to Earth" = 2016-2018 era
   - etc.

3. **Search by Year:**
   - 2024-2025 = Johnny Blue Skies era
   - 2016-2020 = Peak Sturgill era
   - 2012-2015 = Early career

4. **Edit as Needed:**
   - All data is editable in admin panel
   - Add notes, update song titles, etc.
   - Your database, your rules!

---

## Future Enhancements

### **Possible Features:**

1. **Artist Aliases:**
   - Display "Johnny Blue Skies" for 2024+ shows
   - Display "Sturgill Simpson" for earlier shows

2. **Era Filtering:**
   - Filter by musical era
   - Group by album/tour

3. **Song Statistics:**
   - Most played songs by era
   - Cover song frequency
   - Setlist evolution over time

---

## Summary

✅ **Search for:** "Sturgill Simpson"  
✅ **Gets you:** All shows including Johnny Blue Skies  
✅ **Total setlists:** 443 (as of Nov 2025)  
✅ **Includes:** Johnny Blue Skies songs, Sturgill classics, 50+ covers  
✅ **Geographic data:** Venues worldwide with coordinates  
✅ **Fully editable:** Customize in admin panel after import  

---

**Your BlueskiesBase will have the complete Sturgill Simpson / Johnny Blue Skies catalog!** 🎸

Run the import and start exploring the data!


# Debug: Song Stats Not Showing for Year/Song Filters

## Issue
Song stats (Originals/Covers badges) don't display when searching by:
- ❌ Year filter
- ❌ Song filter

But they DO display when searching by:
- ✅ Venue filter
- ✅ City filter  
- ✅ Month filter
- ✅ Content filters (Has Notes, Has Photos, Has Poster)

## Debugging Steps

### Step 1: Check Browser Console
When you search by **Year** (e.g., "2025"), open browser console (F12) and look for these logs:

```
[SearchPage] No content filtering needed, setting filteredResults = X
[SearchPage] Fetched setlist songs: X songs for Y shows
[SearchPage] Show <show-id> stats: { originals: X, covers: Y, totalSongs: Z }
```

**Questions:**
1. Do you see the "No content filtering needed" log?
2. Do you see the "Fetched setlist songs" log?
3. Do you see the per-show stats logs?
4. What are the values of X, Y, Z?

### Step 2: Check Network Tab
1. Open Network tab in browser dev tools
2. Search by Year "2025"
3. Look for the request to `/api/search/shows?year=2025`
4. Check the response - how many shows are returned?
5. Look for the request to Supabase for `setlist_songs`
6. Check if it's fetching setlist data

### Step 3: Compare with Working Filter
1. Search by Venue (e.g., "Red Rocks Amphitheatre")
2. Check the same logs and network requests
3. Compare the response structure

## Hypothesis

I suspect one of these issues:

### Hypothesis 1: Too Many Results
- Year filter might return 100+ shows
- The setlist_songs query might be hitting a limit
- Check if the Supabase query has a `.limit()` that's cutting off data

### Hypothesis 2: Response Structure Difference
- The `/api/search/shows` endpoint might return data differently for different filters
- Check if `data.shows` is actually an array

### Hypothesis 3: Timing Issue
- Year searches might take longer
- The `filteredResults` effect might run before `results` is fully populated
- Check the order of console logs

### Hypothesis 4: Show ID Format
- Maybe shows returned by year search have different ID format
- The `showIds.map()` might not be working correctly

## Quick Test

Add this temporary logging to SearchPage.jsx around line 167:

```javascript
const showIds = filteredResults.map(show => show.id);
console.log('[DEBUG] filteredResults:', filteredResults.length);
console.log('[DEBUG] showIds:', showIds);
console.log('[DEBUG] First show:', filteredResults[0]);
```

This will help us see:
1. Are filteredResults populated?
2. Do the shows have valid IDs?
3. What does the show object look like?

## Expected Behavior

When searching by Year "2025":
1. Backend returns ~300 shows
2. Frontend sets `results = [300 shows]`
3. Content filtering effect runs, sets `filteredResults = results`
4. Song stats effect runs with `showIds = [300 show IDs]`
5. Fetches setlist_songs for all 300 shows
6. Calculates stats per show
7. Displays badges

## Possible Fix

If the issue is too many shows, we might need to:
1. Batch the setlist_songs queries (e.g., 50 shows at a time)
2. Add pagination to song stats calculation
3. Optimize the Supabase query

Let me know what you find in the console logs!


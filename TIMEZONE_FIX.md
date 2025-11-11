# Timezone Fix - Date Display Issue

## Problem

Dates were displaying **one day earlier** than they should. For example:
- **setlist.fm**: Red Rocks shows on September 16 and 17
- **blueskiesbase**: Displayed as September 15 and 16

---

## Root Cause

### The Issue: UTC vs Local Time Parsing

When you parse a date string like `"2024-09-16"` using JavaScript's `new Date()` constructor:

```javascript
new Date("2024-09-16")  // Parsed as UTC midnight: 2024-09-16T00:00:00Z
```

JavaScript interprets this as **UTC midnight** (00:00:00 UTC).

Then when you call `toLocaleDateString()`:

```javascript
new Date("2024-09-16").toLocaleDateString('en-US')
```

It converts the UTC time to your **local timezone**. If you're in a timezone behind UTC (like US timezones):

- **UTC**: 2024-09-16 00:00:00
- **EST (UTC-5)**: 2024-09-15 19:00:00 ← **Previous day!**
- **PST (UTC-8)**: 2024-09-15 16:00:00 ← **Previous day!**

So the date displays as **September 15** instead of **September 16**.

---

## The Fix

### Before (Incorrect):
```javascript
// ❌ Parses as UTC, then converts to local timezone
new Date(show.show_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
})
```

### After (Correct):
```javascript
// ✅ Parse as local date to avoid timezone conversion
const [year, month, day] = show.show_date.split('-');
const date = new Date(year, month - 1, day);  // Creates local date
date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
})
```

When you use `new Date(year, month, day)` with individual components, JavaScript creates a **local date** instead of UTC, so there's no timezone conversion.

---

## Files Fixed

### 1. **SearchPage.jsx** (Lines 427-440)
**Location**: Show date display in search results

**Before**:
```javascript
{new Date(show.show_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
})}
```

**After**:
```javascript
{(() => {
    // Parse date as local date to avoid timezone issues
    const [year, month, day] = show.show_date.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
})()}
```

---

### 2. **SearchPage.jsx** (Lines 48-54)
**Location**: Year extraction for filter dropdown

**Before**:
```javascript
const uniqueYears = [...new Set(showsData.map(show =>
    new Date(show.show_date).getFullYear()
))].sort((a, b) => b - a);
```

**After**:
```javascript
// Extract unique years - parse as local date to avoid timezone issues
const uniqueYears = [...new Set(showsData.map(show => {
    const [year] = show.show_date.split('-');
    return parseInt(year);
}))].sort((a, b) => b - a);
```

---

### 3. **ShowDetailPage.jsx** (Lines 93-104)
**Location**: `formatDate()` function

**Before**:
```javascript
const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};
```

**After**:
```javascript
const formatDate = (dateString) => {
    // Parse date as local date to avoid timezone issues
    // Date string format: "YYYY-MM-DD"
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};
```

---

### 4. **StatsPage.jsx** (Lines 69-79)
**Location**: `formatDate()` function

**Before**:
```javascript
const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};
```

**After**:
```javascript
const formatDate = (dateString) => {
    // Parse date as local date to avoid timezone issues
    // Date string format: "YYYY-MM-DD"
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};
```

---

### 5. **StatsPage.jsx** (Lines 216-222)
**Location**: Date sorting for "Songs Not Seen"

**Before**:
```javascript
.sort((a, b) => {
    // Sort by most recent show date
    if (!a.mostRecentShow || !b.mostRecentShow) return 0;
    return new Date(b.mostRecentShow.show_date) - new Date(a.mostRecentShow.show_date);
})
```

**After**:
```javascript
.sort((a, b) => {
    // Sort by most recent show date
    if (!a.mostRecentShow || !b.mostRecentShow) return 0;
    // Compare date strings directly (YYYY-MM-DD format sorts correctly)
    return b.mostRecentShow.show_date.localeCompare(a.mostRecentShow.show_date);
})
```

**Note**: Since dates are stored in `YYYY-MM-DD` format, we can compare them as strings directly without parsing.

---

## Why This Works

### Date Constructor Behavior

JavaScript's `Date` constructor has two different behaviors:

1. **String parsing** (treats as UTC):
   ```javascript
   new Date("2024-09-16")  // → 2024-09-16T00:00:00Z (UTC)
   ```

2. **Component parsing** (treats as local):
   ```javascript
   new Date(2024, 8, 16)   // → 2024-09-16T00:00:00 (Local timezone)
   ```

By splitting the date string and using the component constructor, we ensure the date is always interpreted in the **local timezone**, avoiding the off-by-one-day issue.

---

## Testing

### Before Fix:
- Red Rocks 2024: Displayed as **September 15 & 16**
- Any show in US timezones: **One day earlier**

### After Fix:
- Red Rocks 2024: Displays as **September 16 & 17** ✅
- All dates match setlist.fm exactly ✅

---

## Database Storage

**Note**: The dates are stored correctly in the database as `YYYY-MM-DD` format. The issue was only in the **frontend display**, not in the data itself.

The import script (`scripts/import_from_setlistfm.py`) correctly converts dates:
```python
def parse_date(self, date_str: str) -> Optional[str]:
    """Convert date from dd-MM-yyyy to yyyy-MM-dd"""
    dt = datetime.strptime(date_str, '%d-%m-%Y')
    return dt.strftime('%Y-%m-%d')
```

This stores dates as simple date strings without time or timezone information, which is correct.

---

## Git Commit

```
commit fe0805b
Fix: Correct timezone issue causing dates to display one day earlier

- Parse dates as local dates instead of UTC to avoid timezone conversion
- Fixed date display in SearchPage, ShowDetailPage, and StatsPage
- Fixed year extraction for filter dropdown
- Fixed date sorting in stats page
- All dates now match setlist.fm exactly
```

---

## Future Considerations

### Best Practices for Date Handling

1. **Store dates as date-only strings** (YYYY-MM-DD) when time is not relevant ✅ (Already doing this)
2. **Parse as local dates** when displaying ✅ (Fixed)
3. **Use ISO 8601 format** for consistency ✅ (Already doing this)
4. **Avoid timezone conversions** for date-only data ✅ (Fixed)

### Alternative Solutions

If we needed more robust date handling in the future, we could:
- Use a library like `date-fns` or `dayjs` with timezone support
- Use `date-fns/parseISO` with `{ timeZone: 'UTC' }` option
- Store dates with explicit timezone information (if time matters)

For this use case (concert dates without specific times), the current solution is perfect.

---

## Summary

✅ **Problem**: Dates displayed one day earlier due to UTC/local timezone conversion  
✅ **Solution**: Parse dates as local dates using component constructor  
✅ **Result**: All dates now display correctly and match setlist.fm  
✅ **Files Fixed**: SearchPage.jsx, ShowDetailPage.jsx, StatsPage.jsx  
✅ **Deployed**: Changes pushed to GitHub and auto-deployed to Vercel


# Inline Venue Creation Feature

## Overview
Added the ability to create new venues on-the-fly when creating or editing a show in the admin panel, eliminating the need to navigate to a separate venue management page.

## Changes Made

### 1. API Service
**File:** `client/src/services/api.js`

Added `createVenue` function:
```javascript
export const createVenue = async (venueData) => {
    const response = await fetch(`${API_BASE_URL}/api/venues`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(venueData),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create venue');
    }
    return response.json();
};
```

### 2. Show Form Component
**File:** `client/src/pages/admin/ShowForm.jsx`

**New State Variables:**
- `showVenueForm` - Controls visibility of inline venue creation form
- `venueFormData` - Stores new venue data (name, city, state_country, address)
- `venueFormError` - Displays errors from venue creation

**New Functions:**
- `handleVenueFormChange()` - Updates venue form fields
- `handleCreateVenue()` - Submits new venue, adds to list, auto-selects it
- `handleCancelVenueForm()` - Closes form and resets data

**UI Changes:**
- Added "+ Add New Venue" button next to venue dropdown label
- Clicking button shows inline form that replaces the dropdown
- Inline form includes:
  - Venue Name (required)
  - City (required)
  - State/Country (required)
  - Address (optional)
  - Create Venue and Cancel buttons
- After successful creation:
  - New venue is added to the dropdown list (sorted alphabetically)
  - New venue is automatically selected
  - Form closes and returns to dropdown view

## User Experience

### Before
1. User starts creating a show
2. Realizes venue doesn't exist
3. Must navigate away to venue management page
4. Create venue
5. Navigate back to show form
6. Start over entering show data
7. Select the new venue

### After
1. User starts creating a show
2. Realizes venue doesn't exist
3. Clicks "+ Add New Venue" button
4. Fills in venue details in inline form
5. Clicks "Create Venue"
6. Venue is created and automatically selected
7. Continues filling out show form without losing data

## Venue Fields

### Required Fields
- **Name** - Venue name (e.g., "Red Rocks Amphitheatre")
- **City** - City where venue is located (e.g., "Morrison")
- **State/Country** - State or country (e.g., "CO" or "United States")

### Optional Fields
- **Address** - Street address (e.g., "18300 W Alameda Pkwy")

## Backend API
Uses existing `POST /api/venues` endpoint:
- Endpoint: `POST /api/venues`
- Request body: `{ name, city, state_country, address }`
- Response: Created venue object with `id`
- Status: 201 Created on success

## Error Handling
- Displays error message if venue creation fails
- Error message shown in red alert box above form fields
- User can correct errors and retry without losing data
- Cancel button allows user to abandon creation and return to dropdown

## Technical Details

### State Management
- Venue form state is separate from show form state
- Creating a venue doesn't affect show form data
- New venue is added to existing venues array and sorted alphabetically
- New venue ID is automatically set as selected venue

### Form Validation
- Required fields enforced with HTML5 `required` attribute
- Backend validation ensures data integrity
- Frontend displays backend error messages

### UI/UX
- Inline form uses blue border to distinguish from main form
- Form appears in place of dropdown for seamless experience
- Placeholders provide examples of expected input format
- Buttons use consistent styling with rest of admin panel

## Testing Checklist

- [ ] Click "+ Add New Venue" button - form appears
- [ ] Click "Cancel" - form closes, dropdown returns
- [ ] Try to create venue with missing required fields - validation works
- [ ] Create venue with all required fields - venue created successfully
- [ ] Verify new venue appears in dropdown and is selected
- [ ] Verify new venue is sorted alphabetically in list
- [ ] Create show with newly created venue - saves correctly
- [ ] Test error handling - try creating duplicate venue name
- [ ] Verify show form data is preserved when creating venue
- [ ] Test on both "Create Show" and "Edit Show" pages

## Benefits

1. **Improved Workflow** - No need to leave the show creation page
2. **Data Preservation** - Show form data is not lost when creating venue
3. **Faster Data Entry** - Reduces clicks and page loads
4. **Better UX** - Seamless inline experience
5. **Auto-Selection** - New venue is automatically selected after creation
6. **No Duplicate Code** - Uses existing backend API endpoint


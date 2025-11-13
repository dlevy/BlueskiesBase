# Database Migrations

## Fix Existing Usernames (Privacy Update)

### Problem
Previously, when users signed up, their username was set to their email address. This exposed email addresses publicly when users posted notes, photos, or posters.

### Solution
1. **Updated trigger function** (`handle_new_user`) to generate usernames from email addresses
2. **Migration script** to fix existing users who have email addresses as usernames

### How to Apply

#### Step 1: Update the Trigger Function
Run the updated trigger function from `database/schema.sql` (lines 288-330) in your Supabase SQL Editor:

```sql
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    base_username TEXT;
    final_username TEXT;
    username_exists BOOLEAN;
    random_suffix INTEGER;
BEGIN
    -- Extract the part before @ from email and clean it up
    base_username := LOWER(SPLIT_PART(NEW.email, '@', 1));
    
    -- Remove any special characters, keep only alphanumeric and underscores
    base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g');
    
    -- Ensure username is not empty (in case email had only special chars before @)
    IF base_username = '' THEN
        base_username := 'user';
    END IF;
    
    -- Limit to 20 characters to leave room for suffix
    base_username := SUBSTRING(base_username, 1, 20);
    
    -- Try the base username first
    final_username := base_username;
    
    -- Check if username exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) INTO username_exists;
    
    -- If username exists, add random 4-digit suffix until we find a unique one
    WHILE username_exists LOOP
        random_suffix := FLOOR(RANDOM() * 9000 + 1000)::INTEGER; -- Random number between 1000-9999
        final_username := base_username || random_suffix::TEXT;
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE username = final_username) INTO username_exists;
    END LOOP;
    
    -- Insert the profile with generated username
    INSERT INTO public.profiles (id, username)
    VALUES (NEW.id, final_username);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Step 2: Fix Existing Users
Run the migration script `fix_existing_usernames.sql` in your Supabase SQL Editor to update existing users.

This will:
- Find all profiles where username contains `@` (email addresses)
- Generate a new username from the email (e.g., `john.doe@example.com` → `johndoe` or `johndoe1234` if taken)
- Update the profile with the new username

### Examples

| Original Email/Username | New Username |
|------------------------|--------------|
| `john.doe@gmail.com` | `johndoe` |
| `jane_smith@yahoo.com` | `jane_smith` |
| `bob+test@example.com` | `bobtest` |
| `alice@example.com` (if `alice` exists) | `alice1234` |

### Verification

After running the migration, verify that no email addresses are visible:

```sql
-- Check for any remaining email-like usernames
SELECT id, username 
FROM public.profiles 
WHERE username LIKE '%@%';
```

This should return 0 rows.

### Notes

- New users signing up after the trigger update will automatically get generated usernames
- Users can update their username later if they want (the profiles table allows updates)
- The username generation is deterministic for the base part, but adds random suffixes for uniqueness


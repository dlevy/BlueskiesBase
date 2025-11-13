-- Migration: Fix existing usernames that are email addresses
-- This script updates existing profiles where username = email to use generated usernames

DO $$
DECLARE
    profile_record RECORD;
    base_username TEXT;
    final_username TEXT;
    username_exists BOOLEAN;
    random_suffix INTEGER;
BEGIN
    -- Loop through all profiles where username looks like an email (contains @)
    FOR profile_record IN 
        SELECT id, username 
        FROM public.profiles 
        WHERE username LIKE '%@%'
    LOOP
        -- Extract the part before @ from email and clean it up
        base_username := LOWER(SPLIT_PART(profile_record.username, '@', 1));
        
        -- Remove any special characters, keep only alphanumeric and underscores
        base_username := REGEXP_REPLACE(base_username, '[^a-z0-9_]', '', 'g');
        
        -- Ensure username is not empty
        IF base_username = '' THEN
            base_username := 'user';
        END IF;
        
        -- Limit to 20 characters to leave room for suffix
        base_username := SUBSTRING(base_username, 1, 20);
        
        -- Try the base username first
        final_username := base_username;
        
        -- Check if username exists
        SELECT EXISTS(
            SELECT 1 FROM public.profiles 
            WHERE username = final_username 
            AND id != profile_record.id
        ) INTO username_exists;
        
        -- If username exists, add random 4-digit suffix until we find a unique one
        WHILE username_exists LOOP
            random_suffix := FLOOR(RANDOM() * 9000 + 1000)::INTEGER;
            final_username := base_username || random_suffix::TEXT;
            SELECT EXISTS(
                SELECT 1 FROM public.profiles 
                WHERE username = final_username 
                AND id != profile_record.id
            ) INTO username_exists;
        END LOOP;
        
        -- Update the profile with new username
        UPDATE public.profiles 
        SET username = final_username 
        WHERE id = profile_record.id;
        
        RAISE NOTICE 'Updated profile % from % to %', 
            profile_record.id, profile_record.username, final_username;
    END LOOP;
END $$;


-- Check what columns exist in setlist_songs table
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'setlist_songs'
ORDER BY 
    ordinal_position;


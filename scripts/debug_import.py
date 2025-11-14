#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from import_from_setlistfm import SetlistImporter
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Test import for one show
importer = SetlistImporter(force_reimport=True)

artist_data = {
    'name': 'Sturgill Simpson',
    'mbid': 'f6e61750-a6b7-4d88-979b-052345cd0e4a'
}

artist_id = importer.get_or_create_artist(artist_data)
print(f"Artist ID: {artist_id}")

# Search for specific setlist by date (2020-03-10)
import requests
headers = {
    'x-api-key': os.getenv('SETLIST_FM_API_KEY'),
    'Accept': 'application/json'
}
params = {
    'artistMbid': artist_data['mbid'],
    'date': '10-03-2020'  # DD-MM-YYYY format
}
response = requests.get('https://api.setlist.fm/rest/1.0/search/setlists', headers=headers, params=params)
result = response.json()
setlists = result.get('setlist', [])
print(f"Got {len(setlists)} setlists for 2020-03-10")

if setlists:
    setlist = setlists[0]
    print(f"Setlist date: {setlist.get('eventDate')}")
    print(f"Has 'sets' key: {'sets' in setlist}")
    
    if 'sets' in setlist:
        print(f"Sets data: {setlist['sets']}")
        
        if 'set' in setlist['sets']:
            sets = setlist['sets']['set']
            print(f"Number of sets: {len(sets)}")
            
            for i, set_data in enumerate(sets):
                print(f"\nSet {i+1}:")
                print(f"  Is encore: {set_data.get('encore', False)}")
                print(f"  Has songs: {'song' in set_data}")
                
                if 'song' in set_data:
                    songs = set_data['song']
                    print(f"  Number of songs: {len(songs)}")
                    if songs:
                        print(f"  First song: {songs[0].get('name')}")
    
    # Now try to import it
    print("\n" + "="*50)
    print("Attempting import...")
    print("="*50)
    
    # Get show ID for this date
    date = importer.parse_date(setlist.get('eventDate'))
    print(f"Parsed date: {date}")
    
    result = supabase.table('shows').select('id').eq('show_date', date).execute()
    if result.data and len(result.data) > 0:
        show_id = result.data[0]['id']
        print(f"Show ID: {show_id}")
        
        # Check existing setlist_songs before import
        before_result = supabase.table('setlist_songs').select('id').eq('show_id', show_id).execute()
        print(f"Setlist songs BEFORE import: {len(before_result.data) if before_result.data else 0}")
        
        # Try the import
        success = importer.import_setlist(setlist, artist_id)
        print(f"Import success: {success}")
        
        # Check after
        after_result = supabase.table('setlist_songs').select('id').eq('show_id', show_id).execute()
        print(f"Setlist songs AFTER import: {len(after_result.data) if after_result.data else 0}")


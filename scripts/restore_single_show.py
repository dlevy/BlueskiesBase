import os
import sys
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
import requests
import time

load_dotenv()

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
SETLISTFM_API_KEY = os.getenv('SETLISTFM_API_KEY')

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def restore_show_from_date(date_str, show_id):
    """Restore a show's setlist from setlist.fm by date"""
    
    print(f"\n🔍 Searching setlist.fm for show on {date_str}...\n")
    
    # Try Johnny Blue Skies first
    headers = {
        'x-api-key': SETLISTFM_API_KEY,
        'Accept': 'application/json'
    }
    
    # Convert date to setlist.fm format (dd-MM-yyyy)
    date_obj = datetime.strptime(date_str, '%Y-%m-%d')
    setlistfm_date = date_obj.strftime('%d-%m-%Y')
    
    for artist in ['Johnny Blue Skies', 'Sturgill Simpson']:
        print(f"   Trying artist: {artist}")
        
        url = 'https://api.setlist.fm/rest/1.0/search/setlists'
        params = {
            'artistName': artist,
            'date': setlistfm_date,
            'p': 1
        }
        
        response = requests.get(url, headers=headers, params=params)
        
        if response.status_code != 200:
            print(f"   ❌ API error: {response.status_code}")
            continue
        
        data = response.json()
        
        if 'setlist' in data and len(data['setlist']) > 0:
            setlist = data['setlist'][0]
            print(f"   ✅ Found setlist!")
            print(f"      Venue: {setlist['venue']['name']}, {setlist['venue']['city']['name']}")
            print(f"      Date: {setlist['eventDate']}\n")
            
            return import_setlist(setlist, show_id)
    
    print("❌ No setlist found on setlist.fm for this date\n")
    return False

def import_setlist(setlist_data, show_id):
    """Import setlist songs into database"""
    
    # Get all songs from database
    songs_response = supabase.table('songs').select('id, title').execute()
    all_songs = songs_response.data
    
    song_map = {song['title'].lower(): song['id'] for song in all_songs}
    
    setlist_entries = []
    song_order = 1
    
    # Process sets
    if 'sets' in setlist_data and 'set' in setlist_data['sets']:
        for set_index, set_data in enumerate(setlist_data['sets']['set']):
            set_number = set_index + 1
            is_encore = set_data.get('encore') == 1 or set_data.get('name') == 'Encore'
            
            if 'song' in set_data:
                for song in set_data['song']:
                    song_title = song['name']
                    song_id = song_map.get(song_title.lower())
                    
                    if song_id:
                        setlist_entries.append({
                            'show_id': show_id,
                            'song_id': song_id,
                            'set_number': set_number,
                            'song_order': song_order,
                            'is_encore': is_encore,
                            'notes': None,
                            'jams_into': None
                        })
                        print(f"   ✓ Set {set_number}, Song {song_order}: {song_title}")
                        song_order += 1
                    else:
                        print(f"   ⚠️  Song not found in database: {song_title}")
    
    if len(setlist_entries) == 0:
        print("\n❌ No songs to restore")
        return False
    
    print(f"\n📝 Restoring {len(setlist_entries)} songs to setlist...\n")
    
    # Insert setlist entries
    try:
        result = supabase.table('setlist_songs').insert(setlist_entries).execute()
        print(f"✅ Successfully restored {len(result.data)} songs to the setlist!\n")
        return True
    except Exception as e:
        print(f"❌ Error restoring setlist: {e}\n")
        return False

if __name__ == '__main__':
    # Restore September 16, 2025 show
    show_id = '7e34e678-91dc-4457-8840-752d678f3ea9'
    date_str = '2025-09-16'
    
    restore_show_from_date(date_str, show_id)


#!/usr/bin/env python3
"""
Import setlists from setlist.fm API into BlueskiesBase database

Requirements:
    python -m pip install -r scripts/requirements.txt

Usage:
    python scripts/import_from_setlistfm.py --artist "Sturgill Simpson" --limit 50

Environment Variables:
    SETLIST_FM_API_KEY - Your setlist.fm API key
    SUPABASE_URL - Your Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Your Supabase service role key
"""

import os
import sys
import argparse
import time
from datetime import datetime
from typing import Optional, Dict, List
from dotenv import load_dotenv
import requests
from supabase import create_client, Client

# Load environment variables
load_dotenv()

# Configuration
SETLIST_FM_API_KEY = os.getenv('SETLIST_FM_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

# Validate environment variables
if not SETLIST_FM_API_KEY:
    print("❌ Error: SETLIST_FM_API_KEY not set")
    print("Get your API key at: https://www.setlist.fm/settings/api")
    sys.exit(1)

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    print("Check your .env file")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


class SetlistImporter:
    """Import setlists from setlist.fm into BlueskiesBase"""

    BASE_URL = "https://api.setlist.fm/rest/1.0"

    def __init__(self, force_reimport=False):
        self.headers = {
            'x-api-key': SETLIST_FM_API_KEY,
            'Accept': 'application/json'
        }
        self.force_reimport = force_reimport
        self.stats = {
            'setlists_processed': 0,
            'setlists_imported': 0,
            'setlists_skipped': 0,
            'setlists_updated': 0,
            'venues_created': 0,
            'artists_created': 0,
            'songs_created': 0,
            'errors': []
        }

    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make a request to the setlist.fm API"""
        url = f"{self.BASE_URL}/{endpoint}"
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            time.sleep(0.5)  # Rate limiting
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"❌ API request failed: {e}")
            return None

    def search_artist(self, artist_name: str) -> Optional[Dict]:
        """Search for an artist on setlist.fm"""
        print(f"🔍 Searching for artist: {artist_name}")

        result = self._make_request('search/artists', {'artistName': artist_name})

        if result and 'artist' in result and len(result['artist']) > 0:
            # Find exact match or best match
            artists = result['artist']

            # Try to find exact match first
            for artist in artists:
                if artist['name'].lower() == artist_name.lower():
                    print(f"✅ Found exact match: {artist['name']} (MBID: {artist['mbid']})")
                    return {
                        'name': artist['name'],
                        'mbid': artist['mbid'],
                        'sort_name': artist.get('sortName'),
                        'url': artist.get('url')
                    }

            # If no exact match, show options and use first
            print(f"⚠️  No exact match found. Available artists:")
            for i, artist in enumerate(artists[:5], 1):
                print(f"  {i}. {artist['name']} (MBID: {artist['mbid']})")

            artist = artists[0]
            print(f"✅ Using: {artist['name']} (MBID: {artist['mbid']})")
            return {
                'name': artist['name'],
                'mbid': artist['mbid'],
                'sort_name': artist.get('sortName'),
                'url': artist.get('url')
            }
        else:
            print(f"❌ Artist not found: {artist_name}")
            return None

    def get_artist_setlists(self, artist_mbid: str, limit: int = 50) -> List:
        """Get setlists for an artist"""
        print(f"📥 Fetching setlists (limit: {limit})...")

        setlists = []
        page = 1

        while len(setlists) < limit:
            result = self._make_request(f'artist/{artist_mbid}/setlists', {'p': page})

            if not result or 'setlist' not in result or len(result['setlist']) == 0:
                break

            setlists.extend(result['setlist'])
            page += 1

            if len(result['setlist']) < 20:  # Last page
                break

        setlists = setlists[:limit]
        print(f"✅ Found {len(setlists)} setlists")
        return setlists

    def get_or_create_artist(self, artist_data: Dict) -> Optional[str]:
        """Get or create artist in database"""
        try:
            # Try to find by MusicBrainz ID
            if artist_data.get('mbid'):
                result = supabase.table('artists').select('id').eq('musicbrainz_id', artist_data['mbid']).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]['id']

            # Try to find by name
            result = supabase.table('artists').select('id').eq('name', artist_data['name']).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]['id']

            # Create new artist
            new_artist = {
                'name': artist_data['name'],
                'musicbrainz_id': artist_data.get('mbid'),
                'sort_name': artist_data.get('sort_name'),
                'setlistfm_url': artist_data.get('url')
            }

            result = supabase.table('artists').insert(new_artist).execute()
            if result.data and len(result.data) > 0:
                self.stats['artists_created'] += 1
                print(f"  ✅ Created artist: {artist_data['name']}")
                return result.data[0]['id']

        except Exception as e:
            print(f"  ❌ Error creating artist: {e}")
            return None

    def parse_venue(self, venue_data: Dict) -> Dict:
        """Parse venue data from setlist.fm"""
        city = venue_data.get('city', {})
        coords = city.get('coords', {})
        country = city.get('country', {})

        # Build state_country string
        state = city.get('state') or city.get('stateCode')
        country_name = country.get('name')

        if state and country_name:
            state_country = f"{state}, {country_name}"
        elif state:
            state_country = state
        elif country_name:
            state_country = country_name
        else:
            state_country = "Unknown"

        venue_dict = {
            'name': venue_data.get('name'),
            'city': city.get('name'),
            'state_country': state_country
        }

        # Add optional fields if migration was run
        if coords.get('lat'):
            venue_dict['latitude'] = coords.get('lat')
        if coords.get('long'):
            venue_dict['longitude'] = coords.get('long')
        if venue_data.get('id'):
            venue_dict['setlistfm_id'] = venue_data.get('id')
        if venue_data.get('url'):
            venue_dict['setlistfm_url'] = venue_data.get('url')

        return venue_dict

    def get_or_create_venue(self, venue_data: Dict) -> Optional[str]:
        """Get or create venue in database"""
        try:
            parsed = self.parse_venue(venue_data)

            # Try to find by setlist.fm ID
            if parsed.get('setlistfm_id'):
                result = supabase.table('venues').select('id').eq('setlistfm_id', parsed['setlistfm_id']).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]['id']

            # Try to find by name and city
            if parsed.get('name') and parsed.get('city'):
                result = supabase.table('venues').select('id').eq('name', parsed['name']).eq('city', parsed['city']).execute()
                if result.data and len(result.data) > 0:
                    return result.data[0]['id']

            # Create new venue
            result = supabase.table('venues').insert(parsed).execute()
            if result.data and len(result.data) > 0:
                self.stats['venues_created'] += 1
                print(f"  ✅ Created venue: {parsed['name']}, {parsed['city']}")
                return result.data[0]['id']

        except Exception as e:
            print(f"  ❌ Error creating venue: {e}")
            return None

    def get_or_create_song(self, song_name: str, artist_id: str = None, is_cover: bool = False, original_artist: str = None) -> Optional[str]:
        """Get or create song in database and update metadata if it's a cover"""
        try:
            # Try to find by title
            result = supabase.table('songs').select('id, is_original, original_artist').eq('title', song_name).execute()

            if result.data and len(result.data) > 0:
                song_id = result.data[0]['id']
                existing_is_original = result.data[0].get('is_original')
                existing_original_artist = result.data[0].get('original_artist')

                # Update song metadata if we have new cover information
                # Only update if the song doesn't already have this metadata set
                if is_cover and (existing_is_original is None or existing_is_original == True):
                    try:
                        supabase.table('songs').update({
                            'is_original': False,
                            'original_artist': original_artist
                        }).eq('id', song_id).execute()
                        print(f"    ℹ️  Updated '{song_name}' as cover by {original_artist}")
                    except Exception as e:
                        print(f"    ⚠️  Failed to update song metadata: {e}")

                return song_id

            # Create new song with metadata
            new_song = {
                'title': song_name,
                'is_original': not is_cover,  # If it's a cover, is_original = False
                'original_artist': original_artist if is_cover else None
            }

            result = supabase.table('songs').insert(new_song).execute()
            if result.data and len(result.data) > 0:
                self.stats['songs_created'] += 1
                return result.data[0]['id']

        except Exception as e:
            print(f"  ❌ Error creating song '{song_name}': {e}")
            return None

    def parse_date(self, date_str: str) -> Optional[str]:
        """Convert date from dd-MM-yyyy to yyyy-MM-dd"""
        try:
            dt = datetime.strptime(date_str, '%d-%m-%Y')
            return dt.strftime('%Y-%m-%d')
        except:
            return None

    def import_setlist(self, setlist_data: Dict, artist_id: str) -> bool:
        """Import a single setlist"""
        try:
            self.stats['setlists_processed'] += 1

            # Parse date
            date = self.parse_date(setlist_data.get('eventDate', ''))
            if not date:
                print(f"  ⚠️  Skipping setlist with invalid date")
                self.stats['setlists_skipped'] += 1
                return False

            # Get or create venue
            venue_id = None
            if 'venue' in setlist_data:
                venue_id = self.get_or_create_venue(setlist_data['venue'])

            if not venue_id:
                print(f"  ⚠️  Skipping setlist - no venue")
                self.stats['setlists_skipped'] += 1
                return False

            # Check if show already exists
            result = supabase.table('shows').select('id').eq('show_date', date).eq('venue_id', venue_id).execute()
            existing_show_id = None
            if result.data and len(result.data) > 0:
                existing_show_id = result.data[0]['id']

                if not self.force_reimport:
                    print(f"  ⏭️  Show already exists: {date}")
                    self.stats['setlists_skipped'] += 1
                    return False
                else:
                    # Delete existing setlist songs
                    try:
                        supabase.table('setlist_songs').delete().eq('show_id', existing_show_id).execute()
                        print(f"  🔄 Updating existing show: {date}")
                    except Exception as e:
                        print(f"  ⚠️  Error deleting old setlist songs: {e}")

            # Prepare show data - use correct field names
            show_data = {
                'show_date': date,
                'venue_id': venue_id,
                'artist_name': 'Johnny Blue Skies',  # Display name
                'notes': setlist_data.get('info')
            }

            # Add optional fields if migration was run
            if setlist_data.get('id'):
                show_data['setlistfm_id'] = setlist_data.get('id')
            if setlist_data.get('url'):
                show_data['setlistfm_url'] = setlist_data.get('url')
            if setlist_data.get('tour', {}).get('name'):
                show_data['tour_name'] = setlist_data['tour']['name']

            # Try to add artist_id if column exists (from migration)
            try:
                show_data['artist_id'] = artist_id
            except:
                pass

            # Create or update show
            if existing_show_id:
                # Update existing show
                result = supabase.table('shows').update(show_data).eq('id', existing_show_id).execute()
                if not result.data or len(result.data) == 0:
                    print(f"  ❌ Failed to update show")
                    self.stats['setlists_skipped'] += 1
                    return False
                show_id = existing_show_id
                self.stats['setlists_updated'] += 1
            else:
                # Create new show
                result = supabase.table('shows').insert(show_data).execute()
                if not result.data or len(result.data) == 0:
                    print(f"  ❌ Failed to create show")
                    self.stats['setlists_skipped'] += 1
                    return False
                show_id = result.data[0]['id']
                print(f"  ✅ Created show: {date}")

            # Import songs
            if 'sets' in setlist_data and 'set' in setlist_data['sets']:
                self.import_songs(setlist_data['sets']['set'], show_id, artist_id)

            self.stats['setlists_imported'] += 1
            return True

        except Exception as e:
            print(f"  ❌ Error importing setlist: {e}")
            self.stats['errors'].append(str(e))
            return False

    def import_songs(self, sets: List, show_id: str, artist_id: str):
        """Import songs for a setlist"""
        set_number = 1
        setlist_songs_batch = []

        for set_data in sets:
            is_encore = set_data.get('encore', False)

            if 'song' not in set_data:
                continue

            song_order = 1
            for song_data in set_data['song']:
                song_name = song_data.get('name')
                if not song_name:
                    continue

                # Check if it's a cover from setlist.fm
                is_cover = 'cover' in song_data
                original_artist = song_data.get('cover', {}).get('name') if is_cover else None

                # Get or create song - now updates song metadata in songs table
                song_id = self.get_or_create_song(song_name, artist_id, is_cover, original_artist)
                if not song_id:
                    continue

                # Create setlist_song entry - ONLY junction table fields
                setlist_song = {
                    'show_id': show_id,
                    'song_id': song_id,
                    'set_number': set_number,
                    'song_order': song_order,
                    'is_encore': is_encore,
                    'notes': song_data.get('info'),  # Performance-specific notes only
                    'jams_into': False  # setlist.fm doesn't provide this
                }

                setlist_songs_batch.append(setlist_song)
                song_order += 1

            set_number += 1

        # Batch insert all songs for this setlist
        if setlist_songs_batch:
            try:
                supabase.table('setlist_songs').insert(setlist_songs_batch).execute()
            except Exception as e:
                print(f"    ⚠️  Failed to insert songs batch: {e}")
                # Try inserting one by one as fallback
                for setlist_song in setlist_songs_batch:
                    try:
                        supabase.table('setlist_songs').insert(setlist_song).execute()
                    except Exception as e2:
                        print(f"    ⚠️  Failed to add individual song: {e2}")

    def print_stats(self):
        """Print import statistics"""
        print("\n" + "="*50)
        print("📊 IMPORT STATISTICS")
        print("="*50)
        print(f"Setlists processed:  {self.stats['setlists_processed']}")
        print(f"Setlists imported:   {self.stats['setlists_imported']}")
        print(f"Setlists updated:    {self.stats['setlists_updated']}")
        print(f"Setlists skipped:    {self.stats['setlists_skipped']}")
        print(f"Venues created:      {self.stats['venues_created']}")
        print(f"Artists created:     {self.stats['artists_created']}")
        print(f"Songs created:       {self.stats['songs_created']}")
        print(f"Errors:              {len(self.stats['errors'])}")
        print("="*50)


def main():
    parser = argparse.ArgumentParser(description='Import setlists from setlist.fm')
    parser.add_argument('--artist', type=str, default='Sturgill Simpson', help='Artist name to search for')
    parser.add_argument('--limit', type=int, default=50, help='Maximum number of setlists to import')
    parser.add_argument('--force', action='store_true', help='Force reimport and update existing shows')
    args = parser.parse_args()

    print("🎸 BlueskiesBase Setlist Importer")
    print("="*50)

    if args.force:
        print("⚠️  FORCE MODE: Will update existing shows")
        print("="*50)

    importer = SetlistImporter(force_reimport=args.force)

    # Search for artist
    artist_data = importer.search_artist(args.artist)
    if not artist_data:
        print("❌ Could not find artist. Exiting.")
        sys.exit(1)

    # Get or create artist in database
    artist_id = importer.get_or_create_artist(artist_data)
    if not artist_id:
        print("❌ Could not create artist in database. Exiting.")
        sys.exit(1)

    # Get setlists
    setlists = importer.get_artist_setlists(artist_data['mbid'], args.limit)
    if not setlists:
        print("❌ No setlists found. Exiting.")
        sys.exit(1)

    # Import setlists
    print(f"\n📥 Importing {len(setlists)} setlists...")
    print("-"*50)

    for i, setlist in enumerate(setlists, 1):
        venue_name = setlist.get('venue', {}).get('name', 'Unknown')
        date = setlist.get('eventDate', 'Unknown')
        print(f"\n[{i}/{len(setlists)}] {date} - {venue_name}")
        importer.import_setlist(setlist, artist_id)

    # Print statistics
    importer.print_stats()

    print("\n✅ Import complete!")


if __name__ == '__main__':
    main()
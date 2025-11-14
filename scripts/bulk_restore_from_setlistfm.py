#!/usr/bin/env python3
"""
Bulk restore setlists for all 142 affected shows from setlist.fm

This script:
1. Reads the list of shows with empty setlists from the database
2. Searches setlist.fm for each show by date
3. Imports the setlist data
4. Provides detailed progress and error reporting

Requirements:
    python -m pip install -r scripts/requirements.txt

Usage:
    python scripts/bulk_restore_from_setlistfm.py [--dry-run] [--limit N]

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

# Add scripts directory to path for imports
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

# Load environment variables
load_dotenv()

# Configuration
SETLIST_FM_API_KEY = os.getenv('SETLIST_FM_API_KEY')
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

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


class BulkSetlistRestorer:
    """Restore setlists for shows with empty setlists"""

    BASE_URL = "https://api.setlist.fm/rest/1.0"
    ARTIST_MBID = "f6e61750-a6b7-4d88-979b-052345cd0e4a"  # Sturgill Simpson MBID

    def __init__(self, dry_run=False):
        self.headers = {
            'x-api-key': SETLIST_FM_API_KEY,
            'Accept': 'application/json'
        }
        self.dry_run = dry_run
        self.stats = {
            'shows_checked': 0,
            'shows_restored': 0,
            'shows_not_found': 0,
            'shows_skipped': 0,
            'shows_empty_on_setlistfm': 0,
            'errors': []
        }

    def _make_request(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict]:
        """Make a request to the setlist.fm API with rate limiting"""
        url = f"{self.BASE_URL}/{endpoint}"
        try:
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            time.sleep(1)  # Conservative rate limiting (1 request per second)
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"    ❌ API request failed: {e}")
            return None

    def get_empty_shows(self, limit: Optional[int] = None) -> List[Dict]:
        """Get all shows with empty setlists from database"""
        print("🔍 Finding shows with empty setlists...")

        try:
            # Get all shows
            result = supabase.table('shows').select(
                'id, show_date, artist_name, venues(name, city, state_country)'
            ).order('show_date', desc=True).execute()

            if not result.data:
                print("❌ No shows found in database")
                return []

            empty_shows = []
            for show in result.data:
                # Check if show has any setlist songs
                setlist_result = supabase.table('setlist_songs').select('id').eq(
                    'show_id', show['id']
                ).limit(1).execute()

                if not setlist_result.data or len(setlist_result.data) == 0:
                    empty_shows.append(show)

                if limit and len(empty_shows) >= limit:
                    break

            print(f"✅ Found {len(empty_shows)} shows with empty setlists")
            return empty_shows

        except Exception as e:
            print(f"❌ Error querying database: {e}")
            return []

    def search_setlist_by_date(self, date: str, venue_name: str = None) -> Optional[Dict]:
        """Search for a setlist on setlist.fm by date"""
        # Convert date from YYYY-MM-DD to DD-MM-YYYY for setlist.fm
        try:
            dt = datetime.strptime(date, '%Y-%m-%d')
            setlistfm_date = dt.strftime('%d-%m-%Y')
        except:
            print(f"    ⚠️  Invalid date format: {date}")
            return None

        # Search for setlist by artist and date
        params = {
            'artistMbid': self.ARTIST_MBID,
            'date': setlistfm_date
        }

        result = self._make_request('search/setlists', params)

        if result and 'setlist' in result and len(result['setlist']) > 0:
            setlists = result['setlist']

            # If venue name provided, try to match
            if venue_name:
                for setlist in setlists:
                    if setlist.get('venue', {}).get('name', '').lower() == venue_name.lower():
                        return setlist

            # Return first match
            return setlists[0]

        return None

    def restore_show(self, show: Dict) -> bool:
        """Restore setlist for a single show"""
        self.stats['shows_checked'] += 1

        show_date = show['show_date']
        venue = show.get('venues', {})
        venue_name = venue.get('name', 'Unknown') if venue else 'Unknown'
        venue_city = venue.get('city', '') if venue else ''

        print(f"\n[{self.stats['shows_checked']}] {show_date} - {venue_name}, {venue_city}")

        if self.dry_run:
            print("    🔍 DRY RUN - Would search setlist.fm")
            return False

        # Search for setlist on setlist.fm
        setlist = self.search_setlist_by_date(show_date, venue_name)

        if not setlist:
            print(f"    ⚠️  Setlist not found on setlist.fm")
            self.stats['shows_not_found'] += 1
            self.stats['errors'].append(f"{show_date} - {venue_name}: Not found on setlist.fm")
            return False

        # Import the setlist using the import script logic
        try:
            from import_from_setlistfm import SetlistImporter

            importer = SetlistImporter(force_reimport=True)

            # Get or create artist
            artist_data = {
                'name': 'Sturgill Simpson',
                'mbid': self.ARTIST_MBID
            }
            artist_id = importer.get_or_create_artist(artist_data)

            if not artist_id:
                print(f"    ❌ Failed to get artist ID")
                self.stats['errors'].append(f"{show_date}: Failed to get artist ID")
                return False

            # Check if setlist has any songs
            has_songs = False
            if 'sets' in setlist and 'set' in setlist['sets']:
                for set_data in setlist['sets']['set']:
                    if 'song' in set_data and len(set_data['song']) > 0:
                        has_songs = True
                        break

            if not has_songs:
                print(f"    ⚠️  Setlist found but has no songs on setlist.fm")
                self.stats['shows_empty_on_setlistfm'] += 1
                self.stats['errors'].append(f"{show_date} - {venue_name}: Empty on setlist.fm")
                return False

            # Import the setlist
            success = importer.import_setlist(setlist, artist_id)

            if success:
                print(f"    ✅ Restored setlist")
                self.stats['shows_restored'] += 1
                return True
            else:
                print(f"    ❌ Failed to import setlist")
                self.stats['errors'].append(f"{show_date}: Import failed")
                return False

        except Exception as e:
            print(f"    ❌ Error: {e}")
            self.stats['errors'].append(f"{show_date}: {str(e)}")
            return False

    def print_stats(self):
        """Print restoration statistics"""
        print("\n" + "="*60)
        print("📊 BULK RESTORATION STATISTICS")
        print("="*60)
        print(f"Shows checked:               {self.stats['shows_checked']}")
        print(f"Shows restored:              {self.stats['shows_restored']}")
        print(f"Shows not found on setlist.fm: {self.stats['shows_not_found']}")
        print(f"Shows empty on setlist.fm:   {self.stats['shows_empty_on_setlistfm']}")
        print(f"Shows skipped:               {self.stats['shows_skipped']}")
        print(f"Total errors:                {len(self.stats['errors'])}")

        if self.stats['errors']:
            print("\n⚠️  SHOWS THAT COULD NOT BE RESTORED:")
            for error in self.stats['errors'][:20]:  # Show first 20 errors
                print(f"  - {error}")
            if len(self.stats['errors']) > 20:
                print(f"  ... and {len(self.stats['errors']) - 20} more")

        print("="*60)


def main():
    parser = argparse.ArgumentParser(description='Bulk restore setlists from setlist.fm')
    parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')
    parser.add_argument('--limit', type=int, help='Limit number of shows to process (for testing)')
    args = parser.parse_args()

    print("🎸 BlueskiesBase Bulk Setlist Restorer")
    print("="*60)

    if args.dry_run:
        print("⚠️  DRY RUN MODE: No changes will be made")
        print("="*60)

    restorer = BulkSetlistRestorer(dry_run=args.dry_run)

    # Get empty shows
    empty_shows = restorer.get_empty_shows(limit=args.limit)

    if not empty_shows:
        print("\n✅ No shows need restoration!")
        return

    print(f"\n📥 Processing {len(empty_shows)} shows...")
    print("-"*60)

    # Process each show
    for show in empty_shows:
        restorer.restore_show(show)

    # Print statistics
    restorer.print_stats()

    if not args.dry_run:
        print("\n✅ Bulk restoration complete!")
    else:
        print("\n✅ Dry run complete! Run without --dry-run to actually restore.")


if __name__ == '__main__':
    main()


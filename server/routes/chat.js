const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../config/supabase');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert assistant for BlueskiesBase, a fan-built database tracking live concerts by Johnny Blue Skies (the country/rock alias of Sturgill Simpson). The database covers shows, setlists, venues, and a full song library.

When answering:
- Always use the tools to look up real data — never guess dates or setlists
- Format dates as "Month Day, Year" (e.g. "June 15, 2023")
- Be conversational and enthusiastic — you're talking to fellow fans
- If a song search returns multiple matches, pick the closest and proceed
- For "last played" questions, surface the most recent performance with date and venue
- For setlists, organize by set (Set 1, Set 2, Encore) and note teases/partials
- If no results are found, say so clearly

Today's date is ${new Date().toISOString().split('T')[0]}.`;

const tools = [
    {
        name: 'search_songs',
        description: "Search for songs by title to get their ID. Always call this first when a user asks about a specific song.",
        input_schema: {
            type: 'object',
            properties: {
                title: { type: 'string', description: 'Song title to search (partial match)' }
            },
            required: ['title']
        }
    },
    {
        name: 'get_song_performances',
        description: 'Get every show where a specific song was performed, sorted most-recent first. Use this for "last played", "how many times", "when was X played" questions.',
        input_schema: {
            type: 'object',
            properties: {
                song_id: { type: 'string', description: 'UUID of the song' },
                limit: { type: 'number', description: 'Max results (default 50; use 1000 for all-time totals)' }
            },
            required: ['song_id']
        }
    },
    {
        name: 'search_shows',
        description: 'Search for shows by year, venue, city, or state.',
        input_schema: {
            type: 'object',
            properties: {
                year: { type: 'string', description: 'e.g. "2023"' },
                venue: { type: 'string', description: 'Venue name (partial match)' },
                city: { type: 'string', description: 'City name (partial match)' },
                state: { type: 'string', description: 'State or country (partial match)' }
            }
        }
    },
    {
        name: 'get_show_setlist',
        description: 'Get the full setlist for a specific show. Use after finding a show_id from search_shows.',
        input_schema: {
            type: 'object',
            properties: {
                show_id: { type: 'string', description: 'UUID of the show' }
            },
            required: ['show_id']
        }
    },
    {
        name: 'get_top_songs',
        description: 'Get the most frequently played songs across all shows.',
        input_schema: {
            type: 'object',
            properties: {
                limit: { type: 'number', description: 'Number of top songs to return (default 10, max 25)' }
            }
        }
    }
];

async function executeTool(name, input) {
    try {
        switch (name) {
            case 'search_songs': {
                const { data, error } = await supabase
                    .from('songs')
                    .select('id, title, is_original, original_artist')
                    .ilike('title', `%${input.title}%`)
                    .order('title')
                    .limit(10);
                if (error) return { error: error.message };
                return { songs: data };
            }

            case 'get_song_performances': {
                const limit = Math.min(input.limit || 50, 1000);

                // Get all setlist_songs entries for this song
                const { data: entries, error: entryErr } = await supabase
                    .from('setlist_songs')
                    .select('show_id, set_number, is_encore, performance_type')
                    .eq('song_id', input.song_id);
                if (entryErr) return { error: entryErr.message };
                if (!entries || entries.length === 0) return { total: 0, performances: [] };

                // Fetch show details for all those show IDs
                const showIds = [...new Set(entries.map(e => e.show_id))];
                const { data: shows, error: showErr } = await supabase
                    .from('shows')
                    .select('id, show_date, venues(name, city, state_country)')
                    .in('id', showIds)
                    .order('show_date', { ascending: false });
                if (showErr) return { error: showErr.message };

                const showMap = Object.fromEntries(shows.map(s => [s.id, s]));
                const performances = entries
                    .filter(e => showMap[e.show_id])
                    .map(e => {
                        const show = showMap[e.show_id];
                        return {
                            show_id: e.show_id,
                            date: show.show_date,
                            venue: show.venues?.name,
                            city: show.venues?.city,
                            state: show.venues?.state_country,
                            set: e.is_encore ? 'Encore' : `Set ${e.set_number}`,
                            performance_type: e.performance_type || 'full'
                        };
                    })
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, limit);

                return { total_performances: entries.length, shown: performances.length, performances };
            }

            case 'search_shows': {
                let query = supabase
                    .from('shows')
                    .select('id, show_date, venues(name, city, state_country)')
                    .order('show_date', { ascending: false })
                    .limit(50);

                if (input.year) {
                    query = query
                        .gte('show_date', `${input.year}-01-01`)
                        .lte('show_date', `${input.year}-12-31`);
                }

                const { data, error } = await query;
                if (error) return { error: error.message };

                let shows = data;
                if (input.venue) shows = shows.filter(s => s.venues?.name?.toLowerCase().includes(input.venue.toLowerCase()));
                if (input.city) shows = shows.filter(s => s.venues?.city?.toLowerCase().includes(input.city.toLowerCase()));
                if (input.state) shows = shows.filter(s => s.venues?.state_country?.toLowerCase().includes(input.state.toLowerCase()));

                return {
                    count: shows.length,
                    shows: shows.map(s => ({
                        id: s.id,
                        date: s.show_date,
                        venue: s.venues?.name,
                        city: s.venues?.city,
                        state: s.venues?.state_country
                    }))
                };
            }

            case 'get_show_setlist': {
                const { data: show, error: showErr } = await supabase
                    .from('shows')
                    .select('show_date, venues(name, city, state_country)')
                    .eq('id', input.show_id)
                    .single();
                if (showErr) return { error: showErr.message };

                const { data: setlist, error: slErr } = await supabase
                    .from('setlist_songs')
                    .select('set_number, song_order, is_encore, notes, performance_type, songs(title, is_original, original_artist)')
                    .eq('show_id', input.show_id)
                    .order('set_number')
                    .order('song_order');
                if (slErr) return { error: slErr.message };

                const sets = {};
                setlist.forEach(item => {
                    const key = item.is_encore ? 'Encore' : `Set ${item.set_number}`;
                    if (!sets[key]) sets[key] = [];
                    const entry = { title: item.songs?.title };
                    if (item.performance_type && item.performance_type !== 'full') entry.performance_type = item.performance_type;
                    if (item.notes) entry.notes = item.notes;
                    if (!item.songs?.is_original) entry.original_artist = item.songs?.original_artist;
                    sets[key].push(entry);
                });

                return {
                    date: show.show_date,
                    venue: show.venues?.name,
                    city: show.venues?.city,
                    state: show.venues?.state_country,
                    setlist: sets
                };
            }

            case 'get_top_songs': {
                const limit = Math.min(input.limit || 10, 25);

                // Paginate through all setlist_songs to count appearances
                const PAGE = 1000;
                let all = [];
                let from = 0;
                while (true) {
                    const { data, error } = await supabase
                        .from('setlist_songs')
                        .select('song_id, songs(title)')
                        .range(from, from + PAGE - 1);
                    if (error) return { error: error.message };
                    all = all.concat(data);
                    if (data.length < PAGE) break;
                    from += PAGE;
                }

                const counts = {};
                all.forEach(item => {
                    const id = item.song_id;
                    const title = item.songs?.title || 'Unknown';
                    if (!counts[id]) counts[id] = { title, count: 0 };
                    counts[id].count++;
                });

                return {
                    top_songs: Object.values(counts)
                        .sort((a, b) => b.count - a.count)
                        .slice(0, limit)
                };
            }

            default:
                return { error: `Unknown tool: ${name}` };
        }
    } catch (err) {
        return { error: err.message };
    }
}

router.post('/', async (req, res) => {
    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            return res.status(500).json({ error: 'Chat is not configured (missing API key).' });
        }

        const { messages } = req.body;
        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array required' });
        }

        // Cap history to last 20 turns to control costs
        const history = messages.slice(-20);
        let current = [...history];

        // Agentic loop: run until Claude stops calling tools
        for (let i = 0; i < 10; i++) {
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                tools,
                messages: current
            });

            if (response.stop_reason === 'end_turn') {
                const text = response.content.find(b => b.type === 'text');
                return res.json({ reply: text?.text || 'No response generated.' });
            }

            if (response.stop_reason === 'tool_use') {
                current.push({ role: 'assistant', content: response.content });
                const results = [];
                for (const block of response.content) {
                    if (block.type === 'tool_use') {
                        const result = await executeTool(block.name, block.input);
                        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
                    }
                }
                current.push({ role: 'user', content: results });
            } else {
                const text = response.content.find(b => b.type === 'text');
                return res.json({ reply: text?.text || 'Unexpected response.' });
            }
        }

        return res.json({ reply: 'Sorry, I had trouble answering that. Please try again.' });
    } catch (err) {
        console.error('Chat error:', err);
        res.status(500).json({ error: 'Failed to process chat request.' });
    }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');

/** GET /api/bands — all bands sorted alphabetically */
router.get('/', async (req, res) => {
    const { data, error } = await supabase
        .from('bands')
        .select('id, name')
        .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json({ bands: data });
});

/** POST /api/bands — create a new band */
router.post('/', async (req, res) => {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const { data, error } = await supabase
        .from('bands')
        .insert({ name: name.trim() })
        .select('id, name')
        .single();

    if (error) {
        if (error.code === '23505') return res.status(409).json({ error: 'Band already exists' });
        return res.status(500).json({ error: error.message });
    }
    res.status(201).json(data);
});

module.exports = router;

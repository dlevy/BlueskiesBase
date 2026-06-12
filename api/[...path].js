const express = require('express');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Vercel may or may not include /api prefix in req.url for catch-all functions.
// Normalize so routes mounted at /api/* always match.
app.use((req, _res, next) => {
    if (!req.url.startsWith('/api/') && req.url !== '/api') {
        req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
});

app.use('/api/shows', require('../server/routes/shows'));
app.use('/api/songs', require('../server/routes/songs'));
app.use('/api/albums', require('../server/routes/albums'));
app.use('/api/venues', require('../server/routes/venues'));
app.use('/api/search', require('../server/routes/search'));
app.use('/api/users', require('../server/routes/users'));
app.use('/api/notes', require('../server/routes/notes'));
app.use('/api/photos', require('../server/routes/photos'));
app.use('/api/posters', require('../server/routes/posters'));
app.use('/api/chat', require('../server/routes/chat'));

app.use((req, res) => {
    res.status(404).json({ error: 'Not found', path: req.url });
});

module.exports = app;
module.exports.config = {
    api: {
        bodyParser: false
    }
};

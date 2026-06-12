const express = require('express');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/shows', require('../server/routes/shows'));
app.use('/api/songs', require('../server/routes/songs'));
app.use('/api/albums', require('../server/routes/albums'));
app.use('/api/venues', require('../server/routes/venues'));
app.use('/api/search', require('../server/routes/search'));
app.use('/api/users', require('../server/routes/users'));
app.use('/api/notes', require('../server/routes/notes'));
app.use('/api/photos', require('../server/routes/photos'));
app.use('/api/posters', require('../server/routes/posters'));

// Disable Vercel's body parser so Express and multer can handle all body types
module.exports = app;
module.exports.config = {
    api: {
        bodyParser: false
    }
};

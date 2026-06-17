require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// CORS configuration - allow requests from frontend
const corsOptions = {
    origin: process.env.FRONTEND_URL || '*',
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic route
app.get('/', (req, res) => {
    res.json({
        message: 'BlueskiesBase API',
        version: '1.0.0',
        status: 'running'
    });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/shows', require('./server/routes/shows'));
app.use('/api/songs', require('./server/routes/songs'));
app.use('/api/albums', require('./server/routes/albums'));
app.use('/api/venues', require('./server/routes/venues'));
app.use('/api/search', require('./server/routes/search'));
app.use('/api/users', require('./server/routes/users'));
app.use('/api/admin', require('./server/routes/admin'));
app.use('/api/notes', require('./server/routes/notes'));
app.use('/api/photos', require('./server/routes/photos'));
app.use('/api/posters', require('./server/routes/posters'));
app.use('/api/bands',  require('./server/routes/bands'));

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Something went wrong!',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`🚀 BlueskiesBase API server running on port ${PORT}`);
    console.log(`📍 http://localhost:${PORT}`);
});

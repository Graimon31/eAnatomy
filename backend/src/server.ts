import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { modulesRouter } from './routes/modules';
import { slicesRouter } from './routes/slices';
import { polygonsRouter } from './routes/polygons';
import { searchRouter } from './routes/search';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// CORS — allow frontend dev server
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));

// Compression — critical for polygon JSON payloads (can be 2-5 MB uncompressed).
// Brotli is preferred when Accept-Encoding allows; falls back to gzip.
app.use(
  compression({
    level: 6,               // balanced speed/ratio
    threshold: 1024,        // compress responses > 1 KB
    filter: (req, res) => {
      // Always compress JSON and image list responses
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

app.use(express.json());

// Static file serving for slice images (WebP)
app.use(
  '/static/slices',
  express.static(path.join(__dirname, '..', 'public', 'slices'), {
    maxAge: '7d',
    immutable: true,
    setHeaders(res) {
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    },
  })
);

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use('/api/modules', modulesRouter);
app.use('/api/slices', slicesRouter);
app.use('/api/polygons', polygonsRouter);
app.use('/api/search', searchRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`[eAnatomy API] listening on http://localhost:${PORT}`);
});

export default app;

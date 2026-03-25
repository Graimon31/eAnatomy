import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import { modulesRouter } from './routes/modules';
import { slicesRouter } from './routes/slices';
import { polygonsRouter } from './routes/polygons';
import { searchRouter } from './routes/search';
import { initKafkaProducer, disconnectKafka } from './services/kafka';
import { metricsMiddleware, metricsHandler } from './services/metrics';
import { handleClientEvent } from './middleware/tracking';

const app = express();
const PORT = Number(process.env.PORT) || 4000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

// Prometheus metrics — must be before other middleware to capture all requests
app.use(metricsMiddleware);

// CORS — allow frontend dev server
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));

// Compression — critical for polygon JSON payloads (can be 2-5 MB uncompressed).
app.use(
  compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
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

// Client-side event tracking (frontend sends click/navigation events here)
app.post('/api/events', handleClientEvent);

// Prometheus metrics endpoint (scraped by Prometheus every 15s)
app.get('/metrics', metricsHandler);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function start() {
  // Initialize Kafka producer (non-blocking, won't crash if Kafka is down)
  await initKafkaProducer();

  app.listen(PORT, () => {
    console.log(`[eAnatomy API] listening on http://localhost:${PORT}`);
    console.log(`[eAnatomy API] Prometheus metrics at http://localhost:${PORT}/metrics`);
  });
}

// Graceful shutdown
async function shutdown() {
  console.log('[eAnatomy API] Shutting down...');
  await disconnectKafka();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start().catch((err) => {
  console.error('[eAnatomy API] Startup error:', err);
  process.exit(1);
});

export default app;

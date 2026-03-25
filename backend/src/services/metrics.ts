/**
 * Prometheus metrics for Grafana dashboards.
 *
 * Exposes /metrics endpoint with:
 *   - http_requests_total (counter) — by method, route, status
 *   - http_request_duration_seconds (histogram) — latency percentiles
 *   - polygon_cache_hits_total (counter) — backend cache hits
 *   - active_sessions_gauge (gauge) — approximate active sessions
 *   - slice_views_total (counter) — slice view events
 *   - kafka_events_sent_total (counter) — events sent to Kafka
 */
import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Use default registry
const register = client.register;

// Collect default Node.js metrics (CPU, memory, event loop lag, GC)
client.collectDefaultMetrics({
  prefix: 'eanatomy_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ---------------------------------------------------------------------------
// Custom metrics
// ---------------------------------------------------------------------------

export const httpRequestsTotal = new client.Counter({
  name: 'eanatomy_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
});

export const httpRequestDuration = new client.Histogram({
  name: 'eanatomy_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
});

export const sliceViewsTotal = new client.Counter({
  name: 'eanatomy_slice_views_total',
  help: 'Total slice view events',
  labelNames: ['module_id'] as const,
});

export const polygonRequestsTotal = new client.Counter({
  name: 'eanatomy_polygon_requests_total',
  help: 'Total polygon data requests',
  labelNames: ['module_id', 'type'] as const,
});

export const searchQueriesTotal = new client.Counter({
  name: 'eanatomy_search_queries_total',
  help: 'Total search queries',
});

export const kafkaEventsSent = new client.Counter({
  name: 'eanatomy_kafka_events_sent_total',
  help: 'Total events sent to Kafka',
  labelNames: ['topic'] as const,
});

export const activeSessions = new client.Gauge({
  name: 'eanatomy_active_sessions',
  help: 'Approximate number of active sessions (last 5 min)',
});

export const dbQueryDuration = new client.Histogram({
  name: 'eanatomy_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['query_type'] as const,
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.5, 1],
});

// ---------------------------------------------------------------------------
// Express middleware — auto-track request metrics
// ---------------------------------------------------------------------------
export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Normalize route to avoid cardinality explosion
    // e.g. /api/polygons/abc-123/5 → /api/polygons/:moduleId/:sliceIndex
    const route = normalizeRoute(req.route?.path || req.path);

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode,
    });

    httpRequestDuration.observe(
      { method: req.method, route },
      durationSec
    );
  });

  next();
}

function normalizeRoute(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:num');
}

// ---------------------------------------------------------------------------
// /metrics endpoint handler
// ---------------------------------------------------------------------------
export async function metricsHandler(_req: Request, res: Response) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end();
  }
}

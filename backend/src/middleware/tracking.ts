/**
 * Express middleware that extracts a session ID from requests
 * and sends tracking events to Kafka.
 *
 * Session ID comes from:
 *   1. X-Session-Id header (set by frontend)
 *   2. Falls back to a hash of IP + User-Agent
 */
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { sendEvent, type AtlasEvent } from '../services/kafka';
import { sliceViewsTotal, polygonRequestsTotal, searchQueriesTotal } from '../services/metrics';

function getSessionId(req: Request): string {
  const header = req.headers['x-session-id'];
  if (typeof header === 'string' && header.length > 0) return header;

  const raw = `${req.ip}-${req.headers['user-agent'] || 'unknown'}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
}

/**
 * Track polygon requests — fires on GET /api/polygons/:moduleId/:sliceIndex
 */
export function trackSliceView(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode !== 200) return;

    const moduleId = req.params.moduleId;
    const sliceIndex = parseInt(req.params.sliceIndex, 10);
    if (isNaN(sliceIndex)) return;

    sliceViewsTotal.inc({ module_id: moduleId });

    sendEvent({
      type: 'slice_view',
      moduleId,
      sliceIndex,
      sessionId: getSessionId(req),
      timestamp: new Date().toISOString(),
    });
  });
  next();
}

/**
 * Track batch polygon requests
 */
export function trackBatchRequest(req: Request, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (res.statusCode !== 200) return;

    polygonRequestsTotal.inc({
      module_id: req.params.moduleId,
      type: 'batch',
    });
  });
  next();
}

/**
 * Track search queries — fires on GET /api/search
 */
export function trackSearch(req: Request, _res: Response, next: NextFunction) {
  const query = (req.query.q as string) || '';
  const moduleId = (req.query.module as string) || null;

  // Fire after response so we can capture result count
  const origJson = _res.json.bind(_res);
  _res.json = function (body: any) {
    searchQueriesTotal.inc();

    sendEvent({
      type: 'search',
      query,
      moduleId,
      resultCount: body?.results?.length ?? 0,
      sessionId: getSessionId(req),
      timestamp: new Date().toISOString(),
    });

    return origJson(body);
  };
  next();
}

/**
 * Generic event endpoint — POST /api/events
 * Frontend sends click/navigation events here.
 */
export function handleClientEvent(req: Request, res: Response) {
  const sessionId = getSessionId(req);
  const event = req.body as Partial<AtlasEvent>;

  if (!event.type) {
    return res.status(400).json({ error: 'Missing event type' });
  }

  sendEvent({
    ...event,
    sessionId,
    timestamp: new Date().toISOString(),
  } as AtlasEvent);

  res.status(202).json({ accepted: true });
}

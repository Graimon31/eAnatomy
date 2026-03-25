/**
 * Kafka Producer — sends user interaction events to Kafka topics.
 *
 * Topics:
 *   atlas.events.views      — slice view events (user scrolled to a slice)
 *   atlas.events.clicks     — polygon click/select events
 *   atlas.events.searches   — search queries
 *   atlas.events.navigation — zoom, pan, slice change events
 *
 * Each event includes a timestamp, sessionId (from cookie/header),
 * and the relevant payload. These are consumed by the ES indexer
 * for Kibana dashboards and by Grafana for real-time metrics.
 */
import { Kafka, Producer, Partitioners, logLevel } from 'kafkajs';

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------
export interface SliceViewEvent {
  type: 'slice_view';
  moduleId: string;
  sliceIndex: number;
  sessionId: string;
  timestamp: string;
}

export interface PolygonClickEvent {
  type: 'polygon_click';
  moduleId: string;
  sliceIndex: number;
  polygonId: string;
  structureCode: string;
  sessionId: string;
  timestamp: string;
}

export interface SearchEvent {
  type: 'search';
  query: string;
  moduleId: string | null;
  resultCount: number;
  sessionId: string;
  timestamp: string;
}

export interface NavigationEvent {
  type: 'navigation';
  action: 'zoom' | 'pan' | 'reset';
  moduleId: string;
  zoom?: number;
  sessionId: string;
  timestamp: string;
}

export type AtlasEvent = SliceViewEvent | PolygonClickEvent | SearchEvent | NavigationEvent;

// ---------------------------------------------------------------------------
// Kafka client singleton
// ---------------------------------------------------------------------------
const BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const ENABLED = process.env.KAFKA_ENABLED !== 'false';

const kafka = new Kafka({
  clientId: 'eanatomy-api',
  brokers: [BROKER],
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 1000,
    retries: 5,
  },
});

let producer: Producer | null = null;
let connected = false;

export async function initKafkaProducer(): Promise<void> {
  if (!ENABLED) {
    console.log('[kafka] Disabled via KAFKA_ENABLED=false');
    return;
  }

  try {
    producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
      allowAutoTopicCreation: true,
    });

    await producer.connect();
    connected = true;
    console.log(`[kafka] Producer connected to ${BROKER}`);
  } catch (err) {
    console.error('[kafka] Failed to connect producer (non-fatal):', err);
    // Non-fatal — app continues without event streaming
  }
}

export async function disconnectKafka(): Promise<void> {
  if (producer && connected) {
    await producer.disconnect();
    connected = false;
    console.log('[kafka] Producer disconnected');
  }
}

// ---------------------------------------------------------------------------
// Send event — fire-and-forget with error swallowing
// ---------------------------------------------------------------------------
const TOPIC_MAP: Record<AtlasEvent['type'], string> = {
  slice_view: 'atlas.events.views',
  polygon_click: 'atlas.events.clicks',
  search: 'atlas.events.searches',
  navigation: 'atlas.events.navigation',
};

export async function sendEvent(event: AtlasEvent): Promise<void> {
  if (!producer || !connected) return;

  try {
    await producer.send({
      topic: TOPIC_MAP[event.type],
      messages: [
        {
          key: event.sessionId,
          value: JSON.stringify(event),
          timestamp: String(Date.now()),
        },
      ],
    });
  } catch (err) {
    // Never let Kafka failures break the API
    console.warn('[kafka] Failed to send event:', (err as Error).message);
  }
}

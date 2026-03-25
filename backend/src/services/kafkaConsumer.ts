/**
 * Kafka Consumer → Elasticsearch indexer.
 *
 * Consumes events from all atlas.events.* topics and bulk-indexes
 * them into Elasticsearch for Kibana visualization.
 *
 * Runs as a separate process: `npx ts-node src/services/kafkaConsumer.ts`
 * Or as a Docker service (see docker-compose.yml).
 *
 * Index mapping:
 *   atlas-events-YYYY.MM — daily indices with ILM for auto-rollover
 */
import { Kafka, logLevel, EachMessagePayload } from 'kafkajs';
import { Client } from '@elastic/elasticsearch';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const KAFKA_BROKER = process.env.KAFKA_BROKER || 'kafka:9092';
const ES_NODE = process.env.ELASTICSEARCH_URL || 'http://elasticsearch:9200';
const CONSUMER_GROUP = 'eanatomy-es-indexer';

const TOPICS = [
  'atlas.events.views',
  'atlas.events.clicks',
  'atlas.events.searches',
  'atlas.events.navigation',
];

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const kafka = new Kafka({
  clientId: 'eanatomy-consumer',
  brokers: [KAFKA_BROKER],
  logLevel: logLevel.WARN,
  retry: { initialRetryTime: 2000, retries: 10 },
});

const es = new Client({
  node: ES_NODE,
  maxRetries: 5,
  requestTimeout: 10000,
});

// ---------------------------------------------------------------------------
// Bulk buffer — batches events before sending to ES
// ---------------------------------------------------------------------------
const BULK_SIZE = 100;
const BULK_INTERVAL_MS = 5000;
let buffer: Array<{ index: string; body: Record<string, unknown> }> = [];
let flushTimer: NodeJS.Timeout;

async function flushBuffer() {
  if (buffer.length === 0) return;

  const batch = buffer.splice(0, buffer.length);
  const operations = batch.flatMap((doc) => [
    { index: { _index: doc.index } },
    doc.body,
  ]);

  try {
    const result = await es.bulk({ refresh: false, operations });
    if (result.errors) {
      const errors = result.items.filter((item: any) => item.index?.error);
      console.error(`[es-indexer] Bulk errors: ${errors.length}/${batch.length}`);
    } else {
      console.log(`[es-indexer] Indexed ${batch.length} events`);
    }
  } catch (err) {
    console.error('[es-indexer] Bulk index failed:', (err as Error).message);
    // Re-queue failed batch (simple retry)
    buffer.unshift(...batch);
  }
}

// ---------------------------------------------------------------------------
// Index template — create on startup
// ---------------------------------------------------------------------------
async function ensureIndexTemplate() {
  try {
    await es.indices.putIndexTemplate({
      name: 'atlas-events-template',
      index_patterns: ['atlas-events-*'],
      template: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          'index.lifecycle.name': 'atlas-events-policy',
        },
        mappings: {
          properties: {
            type: { type: 'keyword' },
            moduleId: { type: 'keyword' },
            sliceIndex: { type: 'integer' },
            polygonId: { type: 'keyword' },
            structureCode: { type: 'keyword' },
            query: { type: 'text' },
            resultCount: { type: 'integer' },
            action: { type: 'keyword' },
            zoom: { type: 'float' },
            sessionId: { type: 'keyword' },
            timestamp: { type: 'date' },
          },
        },
      },
    });
    console.log('[es-indexer] Index template created');
  } catch (err) {
    console.warn('[es-indexer] Template may already exist:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------
async function handleMessage({ topic, message }: EachMessagePayload) {
  if (!message.value) return;

  try {
    const event = JSON.parse(message.value.toString());
    const date = new Date(event.timestamp || Date.now());
    const index = `atlas-events-${date.toISOString().slice(0, 7)}`; // atlas-events-2026.03

    buffer.push({ index, body: event });

    if (buffer.length >= BULK_SIZE) {
      await flushBuffer();
    }
  } catch (err) {
    console.warn('[es-indexer] Parse error:', (err as Error).message);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('[es-indexer] Starting Kafka → Elasticsearch consumer...');
  console.log(`[es-indexer] Kafka: ${KAFKA_BROKER}, ES: ${ES_NODE}`);

  // Wait for ES to be ready
  let esReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      await es.ping();
      esReady = true;
      break;
    } catch {
      console.log(`[es-indexer] Waiting for Elasticsearch... (${i + 1}/30)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  if (!esReady) {
    console.error('[es-indexer] Elasticsearch not reachable. Exiting.');
    process.exit(1);
  }

  await ensureIndexTemplate();

  const consumer = kafka.consumer({
    groupId: CONSUMER_GROUP,
    sessionTimeout: 30000,
  });

  await consumer.connect();
  console.log('[es-indexer] Kafka consumer connected');

  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  // Periodic flush
  flushTimer = setInterval(flushBuffer, BULK_INTERVAL_MS);

  await consumer.run({ eachMessage: handleMessage });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[es-indexer] Shutting down...');
    clearInterval(flushTimer);
    await flushBuffer();
    await consumer.disconnect();
    await es.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('[es-indexer] Fatal error:', err);
  process.exit(1);
});

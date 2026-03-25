#!/bin/sh
# ──────────────────────────────────────────────────
# Kibana auto-setup: creates Data View + saved search
# Runs once after Kibana becomes available.
# ──────────────────────────────────────────────────
set -e

KIBANA_URL="${KIBANA_URL:-http://kibana:5601}"
MAX_RETRIES=60

echo "[kibana-setup] Waiting for Kibana at ${KIBANA_URL}..."
for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "${KIBANA_URL}/api/status" > /dev/null 2>&1; then
    echo "[kibana-setup] Kibana is ready."
    break
  fi
  if [ "$i" = "$MAX_RETRIES" ]; then
    echo "[kibana-setup] Kibana not reachable after ${MAX_RETRIES} attempts. Exiting."
    exit 1
  fi
  echo "[kibana-setup] Attempt $i/$MAX_RETRIES..."
  sleep 3
done

# ── 1. Create Data View (index pattern) ──────────────────
echo "[kibana-setup] Creating data view 'atlas-events-*'..."
curl -sf -X POST "${KIBANA_URL}/api/data_views/data_view" \
  -H 'kbn-xsrf: true' \
  -H 'Content-Type: application/json' \
  -d '{
    "data_view": {
      "id": "atlas-events",
      "title": "atlas-events-*",
      "timeFieldName": "timestamp",
      "name": "Atlas Events"
    },
    "override": true
  }' && echo ""

# ── 2. Import saved objects (search + dashboard) ─────────
echo "[kibana-setup] Importing saved objects..."
curl -sf -X POST "${KIBANA_URL}/api/saved_objects/_import?overwrite=true" \
  -H 'kbn-xsrf: true' \
  --form file=@/setup/kibana-objects.ndjson && echo ""

echo "[kibana-setup] Done!"

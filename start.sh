#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# eAnatomy — One-Click Bootstrap
#
# Usage:   ./start.sh          (first run — builds everything)
#          ./start.sh --clean  (wipe all data and rebuild)
#          ./start.sh --stop   (stop all containers)
# ══════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${GREEN}[eAnatomy]${NC} $1"; }
warn() { echo -e "${YELLOW}[eAnatomy]${NC} $1"; }
err()  { echo -e "${RED}[eAnatomy]${NC} $1"; }

cd "$(dirname "$0")"

# ── Handle flags ─────────────────────────────────────────────
if [[ "${1:-}" == "--stop" ]]; then
    log "Stopping all services..."
    docker compose down
    log "Done."
    exit 0
fi

if [[ "${1:-}" == "--clean" ]]; then
    warn "Wiping all data (volumes) and rebuilding..."
    docker compose down -v --remove-orphans 2>/dev/null || true
fi

# ── Pre-flight checks ───────────────────────────────────────
if ! command -v docker &> /dev/null; then
    err "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
    exit 1
fi

if ! docker info &> /dev/null; then
    err "Docker daemon is not running. Start Docker Desktop first."
    exit 1
fi

# Check available RAM (containers need ~4GB total)
if command -v free &> /dev/null; then
    AVAIL_MB=$(free -m | awk '/^Mem:/{print $7}')
    if [[ "$AVAIL_MB" -lt 3000 ]]; then
        warn "Only ${AVAIL_MB}MB RAM available. Recommended: 4GB+. Elasticsearch may struggle."
    fi
fi

# ── Build & Start ────────────────────────────────────────────
log "Building images (this takes 1-2 min on first run)..."
docker compose build --parallel 2>&1 | grep -E '(Building|Built|CACHED)' || true

log "Starting all services..."
docker compose up -d

# ── Wait for services ────────────────────────────────────────
log "Waiting for services to become healthy..."

wait_for() {
    local name="$1"
    local url="$2"
    local max_attempts="${3:-60}"

    printf "  %-20s" "$name"
    for i in $(seq 1 "$max_attempts"); do
        if curl -sf "$url" > /dev/null 2>&1; then
            echo -e "${GREEN}ready${NC}"
            return 0
        fi
        sleep 2
    done
    echo -e "${RED}timeout${NC}"
    return 1
}

echo ""
wait_for "PostgreSQL"     "http://localhost:4000/api/health" 45
wait_for "Backend API"    "http://localhost:4000/api/health" 30
wait_for "Frontend"       "http://localhost:5173" 30
wait_for "Kafka UI"       "http://localhost:8080" 45
wait_for "Elasticsearch"  "http://localhost:9200" 60
wait_for "Kibana"         "http://localhost:5601/api/status" 90
wait_for "Prometheus"     "http://localhost:9090/-/healthy" 30
wait_for "Grafana"        "http://localhost:3000/api/health" 30

# ── Generate some demo traffic for dashboards ────────────────
log "Generating demo traffic so dashboards have data..."
for i in $(seq 0 5); do
    # Hit polygon endpoints to trigger Kafka events
    curl -sf "http://localhost:4000/api/polygons/$(curl -sf http://localhost:4000/api/modules | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])" 2>/dev/null || echo "unknown")/$i" > /dev/null 2>&1 || true
    # Hit search endpoint
    curl -sf "http://localhost:4000/api/search?q=hippocampus" > /dev/null 2>&1 || true
done
log "Demo traffic sent."

# ── Print summary ────────────────────────────────────────────
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  eAnatomy is running! Open these URLs in your browser:${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}App (Atlas)${NC}       http://localhost:5173"
echo -e "  ${GREEN}Kafka UI${NC}          http://localhost:8080"
echo -e "  ${GREEN}Kibana${NC}            http://localhost:5601"
echo -e "  ${GREEN}Grafana${NC}           http://localhost:3000   (admin / admin)"
echo -e "  ${GREEN}Prometheus${NC}        http://localhost:9090"
echo ""
echo -e "  ${YELLOW}Stop:${NC}  ./start.sh --stop"
echo -e "  ${YELLOW}Reset:${NC} ./start.sh --clean"
echo ""

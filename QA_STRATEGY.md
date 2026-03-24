# QA Strategy — eAnatomy Atlas

## 1. Memory Leak Detection Strategy

### Browser DevTools Protocol
1. **Heap Snapshots (Chrome DevTools → Memory tab)**
   - Take snapshot after initial load (baseline)
   - Scroll through all 48 slices twice (forward + backward)
   - Take second snapshot
   - Compare: retained `HTMLImageElement` count must not exceed `MAX_CACHED` (30)
   - Check for detached DOM nodes: filter "Detached" in snapshot — count must be 0

2. **Performance Monitor (Chrome → Performance Monitor)**
   - Monitor "JS Heap Size" during 10-minute continuous scroll session
   - Heap should plateau at ~150-200 MB, never exceeding 250 MB
   - If heap grows linearly → leak in image cache eviction or event listeners

3. **Automated Test with Puppeteer**
   ```typescript
   // Scroll through all slices 5 times and measure heap
   for (let round = 0; round < 5; round++) {
     for (let i = 0; i < 48; i++) {
       await page.mouse.wheel({ deltaY: 100 });
       await page.waitForTimeout(50);
     }
   }
   const metrics = await page.metrics();
   expect(metrics.JSHeapUsedSize).toBeLessThan(250 * 1024 * 1024);
   ```

4. **Event Listener Audit**
   - After navigating away from atlas view, run `getEventListeners(document)` in console
   - All canvas-related listeners must be removed (React handles this via cleanup)
   - Check `ResizeObserver` disconnect in `CanvasRenderer` cleanup

5. **`img.src = ""` Verification**
   - In `ImageLRUCache.evict()`, verify that setting `img.src = ""` triggers decoded pixel data release
   - Profile with `performance.measureUserAgentSpecificMemory()` (Chrome 89+)

## 2. Acceptance Criteria — Polygon Accuracy at Extreme Zoom

### AC-1: Polygon-Image Alignment at x10 Zoom
**Given** the atlas is loaded and a polygon is visible
**When** the user zooms to x10 on a specific polygon
**Then** the polygon border must remain pixel-aligned with the anatomical boundary it marks
- **Test**: Overlay a semi-transparent polygon fill and visually confirm it tracks the image
- **Metric**: Border offset must be < 1 pixel in image-space at any zoom level
- **Root cause if failing**: Transform matrix not applied identically to image and polygon path
- **Automated**: Screenshot comparison at zoom levels [1x, 2x, 5x, 10x] against reference renders

### AC-2: Hover Hit-Test Precision at x10 Zoom
**Given** the atlas is zoomed to x10 on a region with overlapping polygons
**When** the user moves the cursor 1px outside a polygon boundary
**Then** the polygon must NOT be highlighted (no false positives)
**And when** the cursor is 1px inside
**Then** the polygon MUST be highlighted (no false negatives)
- **Test**: Programmatically fire `pointermove` events at computed boundary coordinates
- **Metric**: Hit-test accuracy must be 100% at all zoom levels
- **Root cause if failing**: `screenToImage()` inverse transform uses incorrect panX/panY or zoom
- **Automated**:
  ```typescript
  // Get polygon boundary point, test 1px inside and outside
  const [bx, by] = polygon.points[0];
  // Transform to screen space
  const screenX = bx * zoom + panX;
  const screenY = by * zoom + panY;
  // Test at (screenX-1, screenY) — should be OUTSIDE for edge point
  // Test at (screenX+1, screenY) — should be INSIDE (if entering polygon)
  ```

### AC-3: Pan Stability at x10 Zoom
**Given** the atlas is zoomed to x10
**When** the user pans 500px in any direction and then returns to original position
**Then** the polygon overlay must return to its exact original position relative to the image
- **Metric**: Position drift after pan round-trip must be 0px (floating-point tolerance: < 0.01px)
- **Root cause if failing**: Accumulated floating-point error in `deltaPan` or inconsistent transform application
- **Automated**: Record pan start position, execute pan sequence, verify final position matches start within tolerance

## 3. Additional Test Cases

### Performance Tests
- [ ] Render 200 polygons on a single slice at 60 FPS
- [ ] Slice transition (cached) completes in < 16ms
- [ ] Polygon JSON (1000 polygons) decompresses in < 50ms

### Cross-Browser
- [ ] Chrome 90+: full functionality
- [ ] Firefox 90+: Canvas rendering, pointer events
- [ ] Safari 15+: touch events, pinch zoom
- [ ] Mobile Chrome: touch pan/zoom, no accidental browser zoom

import { Router } from "express";
import { listModules, getModule, getSlices } from "../controllers/modules.controller";
import { getModulePolygons, getSlicePolygons } from "../controllers/polygons.controller";

const router = Router();

router.get("/modules", listModules);
router.get("/modules/:slug", getModule);
router.get("/modules/:slug/slices", getSlices);
router.get("/modules/:slug/polygons", getModulePolygons);
router.get("/modules/:slug/polygons/:sliceIndex", getSlicePolygons);

export default router;

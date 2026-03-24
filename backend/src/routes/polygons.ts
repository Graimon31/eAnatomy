import { Router } from 'express';
import { getSlicePolygons, getBatchPolygons } from '../controllers/polygonsController';

export const polygonsRouter = Router();

// Batch must be before :sliceIndex to avoid route conflict
polygonsRouter.get('/:moduleId/batch', getBatchPolygons);
polygonsRouter.get('/:moduleId/:sliceIndex', getSlicePolygons);

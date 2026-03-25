import { Router } from 'express';
import { getSlicePolygons, getBatchPolygons } from '../controllers/polygonsController';
import { trackSliceView, trackBatchRequest } from '../middleware/tracking';

export const polygonsRouter = Router();

// Batch must be before :sliceIndex to avoid route conflict
polygonsRouter.get('/:moduleId/batch', trackBatchRequest, getBatchPolygons);
polygonsRouter.get('/:moduleId/:sliceIndex', trackSliceView, getSlicePolygons);

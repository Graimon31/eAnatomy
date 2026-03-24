import { Router } from 'express';
import { getSlices } from '../controllers/slicesController';

export const slicesRouter = Router();

slicesRouter.get('/:moduleId', getSlices);

import { Router } from 'express';
import { listModules, getModule } from '../controllers/modulesController';

export const modulesRouter = Router();

modulesRouter.get('/', listModules);
modulesRouter.get('/:slugOrId', getModule);

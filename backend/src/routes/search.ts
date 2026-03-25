import { Router } from 'express';
import { searchStructures } from '../controllers/searchController';
import { trackSearch } from '../middleware/tracking';

export const searchRouter = Router();

searchRouter.get('/', trackSearch, searchStructures);

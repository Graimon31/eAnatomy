import { Router } from 'express';
import { searchStructures } from '../controllers/searchController';

export const searchRouter = Router();

searchRouter.get('/', searchStructures);

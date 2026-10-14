import { Router } from 'express';
import * as visibility from '../controllers/visibility.controller.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';
import { resultsQuery } from '../validators/visibility.schemas.js';

// Mounted at /api/visibility behind requireAuth. Project-scoped routes live in project.routes.js.
const router = Router();

router.get('/providers', visibility.providers);
router.get('/runs/:id', validate({ params: idParams }), visibility.getRun);
router.get('/runs/:id/status', validate({ params: idParams }), visibility.runStatus);
router.get('/runs/:id/results', validate({ params: idParams, query: resultsQuery }), visibility.results);

export default router;

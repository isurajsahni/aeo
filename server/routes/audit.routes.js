import { Router } from 'express';
import * as audits from '../controllers/audit.controller.js';
import { validate } from '../middleware/validate.js';
import { idParams } from '../validators/common.js';

// Mounted at /api/audits behind requireAuth.
const router = Router();

router.get('/:id', validate({ params: idParams }), audits.get);
router.get('/:id/status', validate({ params: idParams }), audits.status);
router.get('/:id/pages', validate({ params: idParams }), audits.pages);
router.delete('/:id', validate({ params: idParams }), audits.remove);

export default router;

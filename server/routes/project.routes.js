import { Router } from 'express';
import * as audits from '../controllers/audit.controller.js';
import * as projects from '../controllers/project.controller.js';
import * as visibility from '../controllers/visibility.controller.js';
import { auditLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { startAuditSchema } from '../validators/audit.schemas.js';
import { idParams } from '../validators/common.js';
import { createProjectSchema, updateProjectSchema } from '../validators/project.schemas.js';
import { createPromptSchema, promptParams, startRunSchema, updatePromptSchema } from '../validators/visibility.schemas.js';

// Mounted behind requireAuth in routes/index.js.
const router = Router();

router.get('/', projects.list);
router.post('/', validate({ body: createProjectSchema }), projects.create);
router.get('/:id', validate({ params: idParams }), projects.get);
router.patch('/:id', validate({ params: idParams, body: updateProjectSchema }), projects.update);
router.delete('/:id', validate({ params: idParams }), projects.remove);

router.get('/:id/audits', validate({ params: idParams }), audits.listForProject);
router.post('/:id/audits', auditLimiter, validate({ params: idParams, body: startAuditSchema }), audits.start);

// AI visibility: target prompts and test runs
router.get('/:id/prompts', validate({ params: idParams }), visibility.listPrompts);
router.post('/:id/prompts', validate({ params: idParams, body: createPromptSchema }), visibility.createPrompt);
router.patch('/:id/prompts/:promptId', validate({ params: promptParams, body: updatePromptSchema }), visibility.updatePrompt);
router.delete('/:id/prompts/:promptId', validate({ params: promptParams }), visibility.deletePrompt);
router.get('/:id/visibility-runs', validate({ params: idParams }), visibility.listRuns);
router.post('/:id/visibility-runs', auditLimiter, validate({ params: idParams, body: startRunSchema }), visibility.startRun);

export default router;

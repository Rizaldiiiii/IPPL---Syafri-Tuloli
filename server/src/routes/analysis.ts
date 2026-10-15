import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { currentUserId, getOwnedProject } from '../lib/ownership.js';
import { requireAuth } from '../middleware/auth.js';
import { getProjectAnalysis } from '../services/analysis.js';

export const analysisRouter = Router();

analysisRouter.use(requireAuth);

analysisRouter.get(
  '/projects/:id/analysis',
  asyncHandler(async (req, res) => {
    const project = await getOwnedProject(currentUserId(req), req.params.id);
    res.json(await getProjectAnalysis(project.id));
  }),
);

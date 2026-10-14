import * as visibility from '../services/visibility.service.js';

export async function listPrompts(req, res) {
  res.json({ prompts: await visibility.listPrompts(req.user.id, req.validated.params.id) });
}

export async function createPrompt(req, res) {
  res.status(201).json({ prompt: await visibility.createPrompt(req.user.id, req.validated.params.id, req.validated.body) });
}

export async function updatePrompt(req, res) {
  const { id, promptId } = req.validated.params;
  res.json({ prompt: await visibility.updatePrompt(req.user.id, id, promptId, req.validated.body) });
}

export async function deletePrompt(req, res) {
  const { id, promptId } = req.validated.params;
  await visibility.deletePrompt(req.user.id, id, promptId);
  res.status(204).end();
}

export function providers(_req, res) {
  res.json({ providers: visibility.listProviders() });
}

export async function startRun(req, res) {
  res.status(202).json({ run: await visibility.startRun(req.user.id, req.validated.params.id, req.validated.body) });
}

export async function listRuns(req, res) {
  res.json({ runs: await visibility.listRuns(req.user.id, req.validated.params.id) });
}

export async function getRun(req, res) {
  res.json({ run: await visibility.getRun(req.user.id, req.validated.params.id) });
}

export async function runStatus(req, res) {
  res.json({ run: await visibility.getRun(req.user.id, req.validated.params.id, 'status progress error') });
}

export async function results(req, res) {
  res.json({ results: await visibility.listResults(req.user.id, req.validated.params.id, req.validated.query) });
}

import { Audit } from '../models/Audit.js';
import { AiResult } from '../models/AiResult.js';
import { Page } from '../models/Page.js';
import { Prompt } from '../models/Prompt.js';
import { VisibilityRun } from '../models/VisibilityRun.js';
import { Project } from '../models/Project.js';
import { AppError } from '../utils/AppError.js';

const DUPLICATE_DOMAIN = () => AppError.conflict('You already have a project for this domain', 'DUPLICATE_DOMAIN');

function assertCompetitorsValid(domain, competitors = []) {
  if (competitors.includes(domain)) {
    throw AppError.badRequest('A competitor cannot be the project’s own domain', 'VALIDATION_ERROR', [
      { path: 'competitors', message: 'Remove the project’s own domain from competitors' },
    ]);
  }
}

/** Every query is scoped to the owner, so users can never reach each other's projects. */
async function findOwnedProject(userId, projectId) {
  const project = await Project.findOne({ _id: projectId, user: userId });
  if (!project) throw AppError.notFound('Project not found');
  return project;
}

export function listProjects(userId) {
  return Project.find({ user: userId }).sort({ updatedAt: -1 }).limit(500);
}

export const getProject = findOwnedProject;

export async function createProject(userId, data) {
  assertCompetitorsValid(data.domain, data.competitors);
  try {
    return await Project.create({ ...data, user: userId });
  } catch (err) {
    if (err?.code === 11000) throw DUPLICATE_DOMAIN();
    throw err;
  }
}

export async function updateProject(userId, projectId, changes) {
  const project = await findOwnedProject(userId, projectId);

  for (const [key, value] of Object.entries(changes)) {
    if (value !== undefined) project.set(key, value);
  }
  assertCompetitorsValid(project.domain, project.competitors);

  try {
    return await project.save();
  } catch (err) {
    if (err?.code === 11000) throw DUPLICATE_DOMAIN();
    throw err;
  }
}

export async function deleteProject(userId, projectId) {
  const project = await findOwnedProject(userId, projectId);
  const byProject = { project: project._id };
  await Promise.all([Page, Audit, Prompt, VisibilityRun, AiResult].map((Model) => Model.deleteMany(byProject)));
  await project.deleteOne();
}

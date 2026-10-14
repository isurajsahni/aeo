import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

export const AUDIT_STATUSES = ['queued', 'running', 'completed', 'failed'];
const LEVELS = ['high', 'medium', 'low'];

/** Result of one check (shared by audits and pages). */
export const checkResultSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    category: { type: String, required: true },
    title: String,
    status: { type: String, enum: ['pass', 'warn', 'fail'] },
    score: Number,
    weight: Number,
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    recommendation: String,
    impact: { type: String, enum: LEVELS },
    effort: { type: String, enum: LEVELS },
    skipped: { type: Boolean, default: false },
  },
  { _id: false, minimize: false },
);

const auditSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    url: { type: String, required: true },
    finalUrl: String,
    status: { type: String, enum: AUDIT_STATUSES, default: 'queued' },
    progress: {
      stage: { type: String, default: 'queued' },
      message: { type: String, default: 'Waiting to start' },
      percent: { type: Number, default: 0 },
    },
    crawlConfig: {
      mode: { type: String, enum: ['single', 'site'], default: 'single' },
      maxPages: { type: Number, default: 1 },
      respectRobots: { type: Boolean, default: true },
    },
    scores: {
      overall: Number,
      grade: String,
      categories: [
        {
          _id: false,
          id: String,
          name: String,
          weight: Number,
          score: Number,
          grade: String,
          counts: { pass: Number, warn: Number, fail: Number, skipped: Number },
        },
      ],
    },
    summary: String,
    fixes: [
      {
        _id: false,
        checkId: String,
        title: String,
        category: String,
        status: String,
        score: Number,
        impact: String,
        effort: String,
        bucket: String,
        recommendation: String,
        priority: Number,
      },
    ],
    checks: [checkResultSchema],
    pageCount: { type: Number, default: 0 },
    // The AI visibility test that category F was scored from, if any.
    visibilityRun: { type: mongoose.Schema.Types.ObjectId, ref: 'VisibilityRun', default: null },
    crawlStats: {
      type: new mongoose.Schema({ audited: Number, failed: Number, discovered: Number, skippedByRobots: Number }, { _id: false }),
      default: null,
    },
    error: { message: String, code: String },
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,
  },
  { timestamps: true, minimize: false },
);

// Audit history per project (newest first) and per user.
auditSchema.index({ project: 1, createdAt: -1 });
auditSchema.index({ user: 1, createdAt: -1 });
// Finding in-flight audits (concurrency guard, restart recovery).
auditSchema.index({ status: 1, project: 1 });

auditSchema.plugin(toJSONPlugin);

export const Audit = mongoose.model('Audit', auditSchema);

import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

/** One AI visibility test: every selected prompt asked N times to every selected assistant. */
const visibilityRunSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    config: {
      providers: [String],
      runsPerPrompt: Number,
      promptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Prompt' }],
    },
    progress: {
      done: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
      message: { type: String, default: 'Waiting to start' },
    },
    // summarizeRun() output, plus the provider/model list as run (prompts are snapshotted by text).
    summary: { type: mongoose.Schema.Types.Mixed, default: null },
    usage: { inputTokens: { type: Number, default: 0 }, outputTokens: { type: Number, default: 0 } },
    error: { message: String, code: String },
    startedAt: Date,
    completedAt: Date,
    durationMs: Number,
  },
  { timestamps: true, minimize: false },
);

visibilityRunSchema.index({ project: 1, createdAt: -1 });
visibilityRunSchema.index({ status: 1, project: 1 });
visibilityRunSchema.plugin(toJSONPlugin);

export const VisibilityRun = mongoose.model('VisibilityRun', visibilityRunSchema);

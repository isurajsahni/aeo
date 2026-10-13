import mongoose from 'mongoose';
import { checkResultSchema } from './Audit.js';
import { toJSONPlugin } from './plugins/toJSON.js';

/** Per-page data for an audit. Single-page audits have one; site crawls (Phase 3) have many. */
const pageSchema = new mongoose.Schema(
  {
    audit: { type: mongoose.Schema.Types.ObjectId, ref: 'Audit', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    url: { type: String, required: true },
    finalUrl: String,
    statusCode: Number,
    title: String,
    wordCount: Number,
    schemaTypes: [String],
    score: Number,
    grade: String,
    checks: [checkResultSchema],
    fetchMs: Number,
  },
  { timestamps: true },
);

pageSchema.index({ audit: 1, url: 1 }, { unique: true });
pageSchema.index({ project: 1 });

pageSchema.plugin(toJSONPlugin);

export const Page = mongoose.model('Page', pageSchema);

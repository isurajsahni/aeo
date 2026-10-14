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
    depth: { type: Number, default: 0 },
    // JavaScript rendering ran for this page (capped per crawl).
    rendered: { type: Boolean, default: false },
    score: Number,
    grade: String,
    issues: { fail: { type: Number, default: 0 }, warn: { type: Number, default: 0 } },
    checks: [checkResultSchema],
    fetchMs: Number,
    // Set when the page could not be audited (HTTP error, not HTML, network failure).
    error: { message: String, code: String },
  },
  { timestamps: true },
);

pageSchema.index({ audit: 1, url: 1 }, { unique: true });
pageSchema.index({ project: 1 });
// Pages table: worst pages first.
pageSchema.index({ audit: 1, score: 1 });

pageSchema.plugin(toJSONPlugin);

export const Page = mongoose.model('Page', pageSchema);

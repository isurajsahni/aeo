import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

export const MAX_COMPETITORS = 10;

/** One project per client website. */
const projectSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Normalized bare hostname, e.g. "www.example.com" (see utils/domain.js).
    domain: { type: String, required: true, trim: true, lowercase: true },
    competitors: {
      type: [String],
      default: [],
      validate: {
        validator: (list) => list.length <= MAX_COMPETITORS,
        message: `A project can track at most ${MAX_COMPETITORS} competitors`,
      },
    },
    notes: { type: String, trim: true, maxlength: 2000, default: '' },
    // Extra names the brand goes by in AI answers (the project name and domain are always used).
    brandTerms: { type: [String], default: [] },
    // Denormalized snapshot of the latest completed audit, for the projects list.
    lastAudit: {
      type: new mongoose.Schema(
        {
          audit: { type: mongoose.Schema.Types.ObjectId, ref: 'Audit' },
          score: Number,
          grade: String,
          completedAt: Date,
        },
        { _id: false },
      ),
      default: null,
    },
  },
  { timestamps: true },
);

// A user can only have one project per domain.
projectSchema.index({ user: 1, domain: 1 }, { unique: true });
// Powers the projects list (newest activity first).
projectSchema.index({ user: 1, updatedAt: -1 });

projectSchema.plugin(toJSONPlugin);

export const Project = mongoose.model('Project', projectSchema);

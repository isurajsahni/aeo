import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

/** One answer from one AI assistant to one prompt (one of N repeats). */
const aiResultSchema = new mongoose.Schema(
  {
    run: { type: mongoose.Schema.Types.ObjectId, ref: 'VisibilityRun', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    prompt: { type: mongoose.Schema.Types.ObjectId, ref: 'Prompt', required: true },
    promptText: String,
    provider: { type: String, required: true },
    model: String,
    iteration: Number,
    answer: { type: String, maxlength: 40_000 },
    citations: [{ _id: false, url: String, title: String }],
    analysis: {
      type: new mongoose.Schema(
        {
          brandMentioned: Boolean,
          mentionIndex: Number,
          rank: Number,
          listLength: Number,
          domainCited: Boolean,
          citationPosition: Number,
          citedUrls: [String],
          sentiment: String, // 'positive' | 'neutral' | 'negative' | null (not mentioned)
          competitorsMentioned: [String],
        },
        { _id: false },
      ),
      default: null,
    },
    error: { message: String, code: String },
    latencyMs: Number,
    usage: { inputTokens: Number, outputTokens: Number },
  },
  { timestamps: true },
);

aiResultSchema.index({ run: 1, prompt: 1, provider: 1, iteration: 1 }, { unique: true });
aiResultSchema.index({ project: 1, createdAt: -1 });
aiResultSchema.plugin(toJSONPlugin);

export const AiResult = mongoose.model('AiResult', aiResultSchema);

import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

/** A question a client's customers might ask an AI assistant, e.g. "best dentist in Ludhiana". */
const promptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    // Where the question is asked from; passed to assistants that support it.
    location: {
      type: new mongoose.Schema({ city: String, region: String, country: String }, { _id: false }),
      default: null,
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

promptSchema.index({ project: 1, createdAt: 1 });
promptSchema.plugin(toJSONPlugin);

export const Prompt = mongoose.model('Prompt', promptSchema);

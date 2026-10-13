import mongoose from 'mongoose';
import { toJSONPlugin } from './plugins/toJSON.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    // bcrypt hash. Excluded from queries unless explicitly selected with `+password`.
    password: { type: String, required: true, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.plugin(toJSONPlugin, { hidden: ['password'] });

export const User = mongoose.model('User', userSchema);

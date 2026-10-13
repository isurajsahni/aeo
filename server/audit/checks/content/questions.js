const QUESTION_START = /^(who|what|when|where|why|how|which|whose|can|could|does|do|did|is|are|was|were|should|will|would|may|has|have)\b/i;

/** A heading reads as a question if it ends with "?" or starts with a question word. */
export const isQuestion = (text) => /\?\s*$/.test(text) || QUESTION_START.test(text.trim());

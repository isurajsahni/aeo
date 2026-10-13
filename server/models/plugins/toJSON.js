/**
 * Shared JSON serialization for all models: exposes `id` instead of `_id`,
 * drops `__v`, and never leaks fields listed in `hidden`.
 */
export function toJSONPlugin(schema, { hidden = [] } = {}) {
  schema.set('toJSON', {
    virtuals: false,
    versionKey: false,
    transform(_doc, ret) {
      // Subdocuments without _id (e.g. check results) keep their own `id` field.
      if (ret._id != null) {
        ret.id = ret._id.toString();
        delete ret._id;
      }
      for (const field of hidden) delete ret[field];
      return ret;
    },
  });
}

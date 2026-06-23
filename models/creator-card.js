const { ModelSchema, SchemaTypes, DatabaseModel } = require('@app-core/mongoose');

const modelName = 'creator-cards';

/**
 * @typedef {Object} CreatorCard
 * @property {string} _id - ULID
 * @property {string} title
 * @property {string} [description]
 * @property {string} slug
 * @property {string} creator_reference
 * @property {Object[]} [links]
 * @property {Object} [service_rates]
 * @property {string} status - 'draft' | 'published'
 * @property {string} access_type - 'public' | 'private'
 * @property {string} [access_code]
 * @property {number} created
 * @property {number} updated
 * @property {number|null} deleted
 */

const schemaConfig = {
  _id: { type: SchemaTypes.ULID, required: true },
  title: { type: SchemaTypes.String },
  description: { type: SchemaTypes.String },
  slug: { type: SchemaTypes.String },
  creator_reference: { type: SchemaTypes.String, index: true },
  links: { type: SchemaTypes.Mixed },
  service_rates: { type: SchemaTypes.Mixed },
  status: { type: SchemaTypes.String, index: true },
  access_type: { type: SchemaTypes.String, default: 'public' },
  access_code: { type: SchemaTypes.String },
  created: { type: SchemaTypes.Number },
  updated: { type: SchemaTypes.Number },
  deleted: { type: SchemaTypes.Mixed, default: null },
};

const modelSchema = new ModelSchema(schemaConfig, { collection: modelName });

// Slug uniqueness applies only to live cards. A soft-deleted card (deleted !== null) is
// excluded from this index, so its slug becomes reusable — matching the service's
// findOne({ slug, deleted: null }) lookup and the spec treating deleted cards as non-existent.
modelSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { deleted: null } });

/** @type {CreatorCard} */
module.exports = DatabaseModel.model(modelName, modelSchema);

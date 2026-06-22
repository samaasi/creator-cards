const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const Repository = require('@app/repository/creator-card');
const { CreatorCardMessages } = require('@app/messages');

const deleteSpec = `root {
  slug string<minLength:5|maxLength:50>
  creator_reference string<length:20>
}`;

const parsedDeleteSpec = validator.parse(deleteSpec);

function serializeCard(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: _id, ...rest };
}

async function deleteCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedDeleteSpec);

  let response;

  try {
    const card = await Repository.findOne({ query: { slug: data.slug, deleted: null } });

    if (!card) {
      throwAppError(CreatorCardMessages.NOT_FOUND, ERROR_CODE.NF01);
    }

    const deletedAt = Date.now();

    await Repository.updateOne({
      query: { slug: data.slug },
      updateValues: { deleted: deletedAt },
    });

    response = serializeCard({ ...card, deleted: deletedAt });

    if (response.access_type !== 'private') {
      response.access_code = null;
    }
  } catch (error) {
    appLogger.errorX(error, 'delete-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = deleteCreatorCard;
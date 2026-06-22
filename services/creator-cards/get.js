const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const Repository = require('@app/repository/creator-card');
const { CreatorCardMessages } = require('@app/messages');

const getSpec = `root {
  slug string<minLength:5|maxLength:50>
  access_code? string
}`;

const parsedGetSpec = validator.parse(getSpec);

function serializeCardForGet(doc) {
  const { _id, __v, access_code, ...rest } = doc;
  return { id: _id, ...rest };
}

async function getCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedGetSpec);

  let response;

  try {
    const card = await Repository.findOne({ query: { slug: data.slug, deleted: null } });

    if (!card) {
      throwAppError(CreatorCardMessages.NOT_FOUND, ERROR_CODE.NF01);
    }

    if (card.status === 'draft') {
      throwAppError(CreatorCardMessages.DRAFT_NOT_FOUND, ERROR_CODE.NF02);
    }

    if (card.access_type === 'private') {
      if (!data.access_code) {
        throwAppError(CreatorCardMessages.PRIVATE_NO_CODE, ERROR_CODE.AC03);
      }
      if (data.access_code !== card.access_code) {
        throwAppError(CreatorCardMessages.PRIVATE_WRONG_CODE, ERROR_CODE.AC04);
      }
    }

    response = serializeCardForGet(card);
  } catch (error) {
    appLogger.errorX(error, 'get-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = getCreatorCard;
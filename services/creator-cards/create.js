const validator = require('@app-core/validator');
const { throwAppError, ERROR_CODE } = require('@app-core/errors');
const { appLogger } = require('@app-core/logger');
const { randomBytes } = require('@app-core/randomness');
const Repository = require('@app/repository/creator-card');
const { CreatorCardMessages } = require('@app/messages');

const createSpec = `root {
  title string<minLength:3|maxLength:100>
  description? string<maxLength:500>
  slug? string<minLength:5|maxLength:50>
  creator_reference string<length:20>
  status string(draft|published)
  access_type? string(public|private)
  access_code? string<length:6>
}`;

const parsedCreateSpec = validator.parse(createSpec);

function buildSlugFromTitle(title) {
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-_]/g, '');
}

function appendRandomSuffix(base) {
  const suffix = randomBytes(3);
  return `${base}-${suffix}`;
}

function isAlphanumeric(str) {
  return /^[a-zA-Z0-9]+$/.test(str);
}

function serializeCard(doc) {
  const { _id, __v, ...rest } = doc;
  return { id: _id, ...rest };
}

function validateLinks(links) {
  if (!Array.isArray(links)) {
    throwAppError('links must be an array', ERROR_CODE.INVLDDATA);
  }
  links.forEach((link, i) => {
    if (!link.title || typeof link.title !== 'string' || link.title.length < 1 || link.title.length > 100) {
      throwAppError(`links[${i}].title must be a string between 1 and 100 characters`, ERROR_CODE.INVLDDATA);
    }
    if (!link.url || typeof link.url !== 'string' || link.url.length > 200) {
      throwAppError(`links[${i}].url must be a string with max 200 characters`, ERROR_CODE.INVLDDATA);
    }
    if (!link.url.startsWith('http://') && !link.url.startsWith('https://')) {
      throwAppError(`links[${i}].url must start with http:// or https://`, ERROR_CODE.INVLDDATA);
    }
  });
}

function validateServiceRates(serviceRates) {
  const validCurrencies = ['NGN', 'USD', 'GBP', 'GHS'];
  if (!validCurrencies.includes(serviceRates.currency)) {
    throwAppError(`service_rates.currency must be one of: ${validCurrencies.join(', ')}`, ERROR_CODE.INVLDDATA);
  }
  if (!Array.isArray(serviceRates.rates) || serviceRates.rates.length === 0) {
    throwAppError('service_rates.rates must be a non-empty array', ERROR_CODE.INVLDDATA);
  }
  serviceRates.rates.forEach((rate, i) => {
    if (!rate.name || typeof rate.name !== 'string' || rate.name.length < 3 || rate.name.length > 100) {
      throwAppError(`service_rates.rates[${i}].name must be a string between 3 and 100 characters`, ERROR_CODE.INVLDDATA);
    }
    if (rate.description !== undefined && (typeof rate.description !== 'string' || rate.description.length > 250)) {
      throwAppError(`service_rates.rates[${i}].description must be a string with max 250 characters`, ERROR_CODE.INVLDDATA);
    }
    if (!Number.isInteger(rate.amount) || rate.amount < 1) {
      throwAppError(`service_rates.rates[${i}].amount must be a positive integer`, ERROR_CODE.INVLDDATA);
    }
  });
}

async function createCreatorCard(serviceData, options = {}) {
  const data = validator.validate(serviceData, parsedCreateSpec);

  let response;

  try {
    if (data.links !== undefined) {
      validateLinks(data.links);
    }

    if (data.service_rates !== undefined) {
      if (typeof data.service_rates !== 'object' || Array.isArray(data.service_rates)) {
        throwAppError('service_rates must be an object', ERROR_CODE.INVLDDATA);
      }
      validateServiceRates(data.service_rates);
    }

    const accessType = data.access_type || 'public';

    if (accessType === 'private' && !data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_REQUIRED, ERROR_CODE.AC01);
    }

    if (accessType !== 'private' && data.access_code) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_ON_PUBLIC, ERROR_CODE.AC05);
    }

    if (data.access_code && !isAlphanumeric(data.access_code)) {
      throwAppError(CreatorCardMessages.ACCESS_CODE_INVALID_FORMAT, ERROR_CODE.INVLDDATA);
    }

    let slug = data.slug;
    let slugWasProvided = !!slug;

    if (!slugWasProvided) {
      slug = buildSlugFromTitle(data.title);
    }

    const existing = await Repository.findOne({ query: { slug, deleted: null } });

    if (existing) {
      if (slugWasProvided) {
        throwAppError(CreatorCardMessages.SLUG_TAKEN, ERROR_CODE.SL02);
      }
      
      slug = appendRandomSuffix(slug);
    } else if (!slugWasProvided && slug.length < 5) {
      slug = appendRandomSuffix(slug);
    }

    const cardData = {
      title: data.title,
      slug,
      creator_reference: data.creator_reference,
      status: data.status,
      access_type: accessType,
      deleted: null,
    };

    if (data.description !== undefined) cardData.description = data.description;
    if (data.links !== undefined) cardData.links = data.links;
    if (data.service_rates !== undefined) cardData.service_rates = data.service_rates;
    if (accessType === 'private') cardData.access_code = data.access_code;

    const created = await Repository.create(cardData);

    response = serializeCard(created);
    if (response.access_type !== 'private') {
      response.access_code = null;
    }
  } catch (error) {
    appLogger.errorX(error, 'create-creator-card-error');
    throw error;
  }

  return response;
}

module.exports = createCreatorCard;
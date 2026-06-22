const CreatorCardMessages = {
    CREATED: 'Creator Card Created Successfully.',
    RETRIEVED: 'Creator Card Retrieved Successfully.',
    DELETED: 'Creator Card Deleted Successfully.',
    SLUG_TAKEN: 'Slug is already taken',
    ACCESS_CODE_REQUIRED: 'access_code is required when access_type is private',
    ACCESS_CODE_ON_PUBLIC: 'access_code can only be set on private cards',
    ACCESS_CODE_INVALID_FORMAT: 'access_code must be exactly 6 alphanumeric characters',
    NOT_FOUND: 'Creator card not found',
    DRAFT_NOT_FOUND: 'Creator card not found',
    PRIVATE_NO_CODE: 'This card is private. An access code is required',
    PRIVATE_WRONG_CODE: 'Invalid access code',
};

module.exports = CreatorCardMessages;
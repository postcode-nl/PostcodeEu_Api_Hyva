export const POSTCODE_REGEX = /([1-9]\d{3})\s*([A-Z]{2})/i,
    HOUSE_NUMBER_REGEX = /[1-9]\d{0,4}(\D.*)?$/i,
    ADDRESS_RESULT_STATUS = Object.freeze({
        VALID: 'valid',
        NOT_FOUND: 'notFound',
        ADDITION_INCORRECT: 'houseNumberAdditionIncorrect',
        PO_BOX_NOT_ALLOWED: 'poBoxNotAllowed',
    });

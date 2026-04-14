export const form = document.forms['form-validate'] ?? document.forms['accountcreate'],
    container = form.city.closest('.field').parentElement,
    fields = {
        street: form.querySelector('.street'),
        postcode: form.postcode.closest('.field'),
        city: form.city.closest('.field'),
        region: form.region.closest('.field'),
    },
    streetInputs = fields.street.querySelectorAll('input'),
    getAddressFields = () => Object.values(fields).filter((el) => el),
    getAddressInputs = () => [...streetInputs, form.zip, form.city, form.region, form.region_id].filter((el) => el),
    getStreetValue = () => [...streetInputs].map((input) => input.value).join(' ').trim();

import { form, streetInputs, getStreetValue } from './form.js';
import { t, settings, extractHouseNumber, getValidatedAddress } from '../utils.js';
import { POSTCODE_REGEX, HOUSE_NUMBER_REGEX, ADDRESS_RESULT_STATUS } from '../model/address-nl.js';

export default class {
    status = null;
    address = null;
    loading = false;
    houseNumberOptions = [];

    init() {
        this.$watch('address', (address) => {
            if (address === null) {
                this.formattedAddress = null;
            } else {
                this.setInputAddress(address);
                this.formattedAddress = this.status === ADDRESS_RESULT_STATUS.VALID ? this.getFormattedAddress() : null;
            }
        });

        this.$watch('status', (status) => {
            this.errorMsg = status === ADDRESS_RESULT_STATUS.NOT_FOUND ? t('not-found') : null;
        });

        this.$nextTick(() => {
            // Need to run next tick to wait for region field logic.
            this.toggleFields(this.isNl && this.status === ADDRESS_RESULT_STATUS.VALID);
        });

        if (this.isNl && form.postcode.value && form.street_1.value) {
            Promise.all([this.prefillPostcode(), this.prefillHouseNumber()])
                .then(this.getAddress.bind(this, true))
                .catch(() => {
                    if (HOUSE_NUMBER_REGEX.test(getStreetValue())) {
                        // Fall back to Validate API for ambiguous house number cases.
                        this._getValidatedAddress();
                    }
                })
                .finally(() => {
                    // Update Hyva form validation state.
                    this.setupFields(form.elements);
                    this.validateField(this.fields.postcode_eu_postcode);
                    this.validateField(this.fields.postcode_eu_house_number);
                });
        }
    }

    getAddressParts(address) {
        return {
            ...address,
            houseNumberAddition: address.houseNumberAddition ?? '',
            house: `${address.houseNumber} ${address.houseNumberAddition ?? ''}`.trim(),
            streetParts: [address.street, address.houseNumber, address.houseNumberAddition ?? ''],
        };
    }

    getFormattedAddress() {
        const {street, house, postcode, city} = this.getAddressParts(this.address);

        return `${street} ${house}<br>${postcode} ${city}`;
    }

    setInputAddress(address) {
        const addressParts = this.getAddressParts(address),
            setValue = (id, value) => {
                form[id].value = value;
                form[id].dispatchEvent(new Event('input', {bubbles: true}));

                // See Hyva_Theme: src/view/frontend/templates/page/js/advanded-form-validation.phtml
                this.validateField(this.fields[form[id].name]);
            };
        let streetLines;

        if (settings.split_street_values) {
            const lastChildIndex = streetInputs.length - 1;

            streetLines = addressParts.streetParts.slice(0, lastChildIndex);
            streetLines.push(addressParts.streetParts.slice(lastChildIndex).join(' ').trim());
        } else {
            streetLines = [addressParts.streetParts.join(' ').trim()];
        }

        for (let i = 0; i < streetLines.length; i++) {
            setValue(`street_${i + 1}`, streetLines[i]);
        }

        setValue('city', addressParts.city);
        setValue('zip', addressParts.postcode);

        if (form.region) {
            setValue('region', addressParts.province);
        }
    }

    onInputPostcodeHouseNumber() {
        this.$nextTick(() => { // Get validation state after DOM update.
            if (this.isFieldValid('postcode_eu_postcode') && this.isFieldValid('postcode_eu_house_number')) {
                this.getAddress();
            }
        });
    }

    async getAddress(acceptUnknownAddition = false) {
        const postcodeElement = form.postcode_eu_postcode,
            houseNumberElement = form.postcode_eu_house_number,
            postcode = encodeURIComponent(POSTCODE_REGEX.exec(postcodeElement.value)[0].replace(/\s/g, '')),
            houseNumber = encodeURIComponent(HOUSE_NUMBER_REGEX.exec(houseNumberElement.value)[0].trim()),
            url = `${settings.api_actions.dutchAddressLookup}/${postcode}/${houseNumber}?form_key=${settings.form_key}`;

        this.resetInputAddress();
        this.address = null;
        this.status = null;
        this.houseNumberOptions = [];
        this.errorMsg = null;
        this.loading = true;

        try {
            const response = await fetch(url, {headers: {'X-Requested-With': 'XMLHttpRequest'}});

            if (!response.ok) {
                throw new Error(`Response status: ${response.status}`);
            }

            const [result] = await response.json(); // eslint-disable-line one-var

            if (result.error) {
                if (this.fields.postcode_eu_house_number) {
                    this.createErrorMessage(this.fields.postcode_eu_house_number, result.message);
                } else { // Probably not called via event handler in this case.
                    console.error(result.message);
                }

                return;
            }

            this.status = result.status;

            if (this.status === ADDRESS_RESULT_STATUS.NOT_FOUND) {
                return;
            }

            this.address = result.address;

            if (this.status === ADDRESS_RESULT_STATUS.ADDITION_INCORRECT) {
                if (acceptUnknownAddition) {
                    this.status = ADDRESS_RESULT_STATUS.VALID;
                    this.address.houseNumberAddition = HOUSE_NUMBER_REGEX.exec(houseNumberElement.value)[1].trim();
                } else {
                    this.houseNumberOptions = result.address.houseNumberAdditions.map(
                        (entry) => ({value: entry.houseNumberAddition, label: entry.label})
                    );
                }
            } else {
                this.toggleFields(true);
            }
        } catch (error) {
            this.errorMsg = t('generic-error');
            console.error(error.message);
        } finally {
            this.loading = false;
        }
    }

    onChangeHouseNumberAddition({target: {value}}) {
        this.address.houseNumberAddition = value === '_' ? null : value; // Using underscore as placeholder value.

        const isValid = this.address.houseNumberAddition === null;

        this.status = isValid ? ADDRESS_RESULT_STATUS.ADDITION_INCORRECT : ADDRESS_RESULT_STATUS.VALID;
        this.toggleFields(isValid);
    }

    prefillPostcode() {
        return new Promise((resolve, reject) => {
            if (form.postcode_eu_postcode.value === '') {
                form.postcode_eu_postcode.value = form.postcode.value;
            }

            POSTCODE_REGEX.test(form.postcode_eu_postcode.value) ? resolve() : reject();
        });
    }

    prefillHouseNumber() {
        return new Promise((resolve, reject) => {
            if (form.postcode_eu_house_number.value === '') {
                const houseNumberAndAddition = extractHouseNumber(getStreetValue());

                if (houseNumberAndAddition !== null) {
                    form.postcode_eu_house_number.value = houseNumberAndAddition;
                }
            }

            HOUSE_NUMBER_REGEX.test(form.postcode_eu_house_number.value) ? resolve() : reject();
        });
    }

    _getValidatedAddress() {
        this.loading = true;
        getValidatedAddress('nl', getStreetValue(), form.postcode_eu_postcode.value, form.city.value)
            .then((result) => {
                if (result === null) {
                    this.errorMsg = t('not-found');
                    return;
                }

                const {address} = result;

                form.postcode_eu_postcode.value = address.postcode;
                form.postcode_eu_house_number.value = address.building;
                this.address = {
                    street: address.street,
                    houseNumber: address.buildingNumber,
                    houseNumberAddition: address.buildingNumberAddition,
                    city: address.locality,
                    postcode: address.postcode,
                    province: result.region.name,
                };
                this.status = ADDRESS_RESULT_STATUS.VALID;
                this.toggleFields(true);
            })
            .finally(() => {
                this.loading = false;
            });

        this.resetInputAddress();
    }
}

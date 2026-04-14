import { form, streetInputs, getAddressInputs, getStreetValue } from './form.js';
import { t, settings, getValidatedAddress } from '../utils.js';

const addressDetailsCache = new Map();

export default class {
    loading = false;
    visible = false;
    hasError = false;
    address = null;
    autocompleteInstance = null;
    parent = null;

    init() {
        this.$nextTick(() => {
            this.toggleFields(this.isEnabledCountry());
        });

        this.$watch('address', (result) => {
            if (result === null) {
                this.toggleFields(false);
                this.formattedAddress = null;
            }
            else if (result.error) {
                this.address = null;
            }
            else {
                this.setInputAddress(result);
                this.toggleFields(true);
                this.formattedAddress = this.getFormattedAddress();
            }
        });

        this.$watch('countryCode', (code) => this.onChangeCountry(code));

        this.createAutocompleteInstance();

        this.visible = this.isEnabledCountry(this.countryCode);

        if (this.visible && form.postcode_eu_intl.value === '') {
            this.validatePrefilledValues();
        }
    }

    isEnabledCountry(countryCode) {
        return (
            settings.enabled_countries.includes(countryCode)
            && !(countryCode === 'NL' && settings.nl_input_behavior === 'zip_house')
        );
    }

    onChangeCountry(countryCode) {
        this.address = null;
        this.visible = this.isEnabledCountry(countryCode);
        this.autocompleteInstance?.reset();
        this.autocompleteInstance?.setCountry(countryCode);
    }

    createAutocompleteInstance() {
        this.autocompleteInstance = new PostcodeNl.AutocompleteAddress(this.$refs.intlInput, {
            autocompleteUrl: settings.api_actions.autocomplete,
            addressDetailsUrl: settings.api_actions.addressDetails,
            context: this.countryCode ?? 'NL',
        });

        // Override methods to add form_key.
        this.autocompleteInstance.getSuggestions = function (context, term, response) {
            context = encodeURIComponent(context);
            term = encodeURIComponent(term);

            return this.xhrGet(
                `${this.options.autocompleteUrl}/${context}/${term}?form_key=${settings.form_key}`,
                response
            );
        };

        this.autocompleteInstance.getDetails = function (...args) {
            const response = args.pop();

            return this.xhrGet(
                `${this.options.addressDetailsUrl}/${args.join('/')}?form_key=${settings.form_key}`,
                response
            );
        };
    }

    validatePrefilledValues() {
        const postcode = form.postcode.value,
            city = form.city.value,
            streetAndBuilding = getStreetValue(),
            prefilledAddressValue = `${form.postcode.value} ${form.city.value} ${streetAndBuilding}`.trim();

        if (prefilledAddressValue === '') {
            return;
        }

        this.resetInputAddress();

        if (streetAndBuilding && postcode && city) {
            this.loading = true;

            getValidatedAddress(this.countryCode, streetAndBuilding, postcode, city)
                .then((result) => {
                    if (result !== null) {
                        this.address = result;
                    }
                })
                .finally(() => {
                    this.loading = false;
                    form.postcode_eu_intl.value = prefilledAddressValue;
                    form.postcode_eu_intl.classList.remove('postcodenl-autocomplete-address-input-blank');
                });
        } else {
            // Set incomplete value and trigger validation.
            this.$nextTick(() => {
                form.postcode_eu_intl.value = prefilledAddressValue;
                this.setupFields(form.elements);
                this.validateField(this.fields.postcode_eu_intl);
            });
        }
    }

    getAddressDetails(context, callback) {
        if (addressDetailsCache.has(context)) {
            callback(addressDetailsCache.get(context));
            return;
        }

        this.autocompleteInstance.getDetails(context, (result) => {
            callback(result);
            addressDetailsCache.set(context, result);
        });
    }

    selectAddress(selectedItem) {
        this.loading = true;

        this.getAddressDetails(selectedItem.context, (result) => {
            this.loading = false;
            this.address = result[0];
            this.toggleFields(true);
        });
    }

    onSearch() {
        this.resetInputAddress();
        this.address = null;
        this.errorMsg = null;
        this.hasError = false;
    }

    onSelect(e) {
        if (e.detail.precision === 'Address') {
            this.selectAddress(e.detail);
        }
    }

    onError(e) {
        console.error('Autocomplete XHR error', e);
        this.toggleFields(true);
        this.loading = false;
        this.errorMsg = t('generic-error');
        this.hasError = true;
    }

    onXhrSend({detail: xhr}) {
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    }

    setInputAddress(result) {
        const setValue = (id, value) => {
            form[id].value = value;
            form[id].dispatchEvent(new Event(form[id].matches('input') ? 'input' : 'change', { bubbles: true }));
            this.validateField(this.fields[form[id].name]);
        };

        for (let i = 0; i < result.streetLines.length; i++) {
            setValue(`street_${i + 1}`, result.streetLines[i]);
        }

        setValue('city', result.address.locality);
        setValue('zip', result.address.postcode);

        if (form.region_id) {
            setValue('region_id', result.region.id ?? '');
        } else if (form.region) {
            setValue('region', result.region.name ?? '');
        }
    }

    getFormattedAddress() {
        return this.address.mailLines.join('<br>');
    }
}

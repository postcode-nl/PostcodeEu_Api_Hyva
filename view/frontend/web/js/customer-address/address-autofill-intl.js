import { form, streetInputs, getAddressInputs } from './form.js';
import { t, settings, getValidatedAddress } from '../utils.js';

const addressDetailsCache = new Map();

export default class {
    loading = false;
    visible = false;
    hasError = false;
    address = null;
    autocompleteInstance = null;
    parent = null;
    residenceLine = '';

    get isResidenceLineVisible() {
        return this.visible
            && settings.show_hide_address_fields === 'format'
            && Boolean(settings.residence_line_countries?.includes(this.countryCode));
    }

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

        this.$watch('residenceLine', () => this.onChangeResidenceLine());

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

        // Override methods to process URL template.
        this.autocompleteInstance.getSuggestions = function (context, term, response) {
            context = encodeURIComponent(context);
            term = encodeURIComponent(term);

            return this.xhrGet(
                this.options.autocompleteUrl.replace('{context}', context).replace('{term}', term),
                response
            );
        };

        this.autocompleteInstance.getDetails = function (...args) {
            return this.xhrGet(this.options.addressDetailsUrl.replace('{context}', args[0]), args.at(-1));
        };
    }

    validatePrefilledValues() {
        const postcode = form.postcode.value,
            city = form.city.value,
            {residenceLine, street} = this.splitResidenceLine();

        let prefilledAddressValue = `${postcode} ${city} ${street}`.trim();

        if (prefilledAddressValue === '') {
            return;
        }

        this.resetInputAddress();

        if (street && postcode && city) {
            this.loading = true;

            getValidatedAddress(this.countryCode, street, postcode, city)
                .then((result) => {
                    if (result !== null) {
                        this.residenceLine = residenceLine ?? '';
                        return result;
                    }

                    // Not a residence line after all, retry with the full street.
                    if (residenceLine) {
                        const fullStreet = `${residenceLine} ${street}`;

                        prefilledAddressValue = `${postcode} ${city} ${fullStreet}`.trim();
                        return getValidatedAddress(this.countryCode, fullStreet, postcode, city);
                    }

                    return null;
                })
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

    /**
     * Split the residence line from the saved street lines.
     *
     * The first street line is regarded as the residence line if there's more than one line, the residence line
     * is enabled for the country, and street values are not split into separate inputs.
     *
     * @return {{residenceLine: string|null, street: string}}
     */
    splitResidenceLine() {
        const lines = [...streetInputs].map((input) => input.value.trim()).filter((value) => value !== ''),
            hasResidenceLine = settings.show_hide_address_fields === 'format'
                && settings.residence_line_countries?.includes(this.countryCode)
                && !settings.split_street_values
                && lines.length > 1;

        if (!hasResidenceLine) {
            return {residenceLine: null, street: lines.join(' ')};
        }

        return {residenceLine: lines[0], street: lines.slice(1).join(' ')};
    }

    /**
     * Update the street inputs when the residence line is changed for the selected address.
     */
    onChangeResidenceLine() {
        if (
            this.address === null
            || !this.isResidenceLineVisible
            || this.address.country?.iso2Code !== this.countryCode
        ) {
            return;
        }

        this.setInputAddress(this.address);
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
            },
            residenceLine = this.isResidenceLineVisible ? this.residenceLine.trim() : '',
            streetLines = [...result.streetLines],
            lineCount = streetInputs.length;

        if (residenceLine !== '') {
            streetLines.unshift(residenceLine);
        }

        // Join any extra lines into the last available street input.
        if (streetLines.length > lineCount) {
            streetLines.push(streetLines.splice(lineCount - 1).join(' '));
        }

        // Write every street input, so lines left over from a previous or longer address are cleared
        // (e.g. after removing the residence line).
        for (let i = 0; i < lineCount; i++) {
            setValue(`street_${i + 1}`, streetLines[i] ?? '');
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

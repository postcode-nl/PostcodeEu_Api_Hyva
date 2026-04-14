import { container, form, fields, getAddressInputs, getAddressFields } from './form.js';
import { settings } from '../utils.js';

export default class {
    isNl = form.country.value === 'NL';
    formattedAddress = null;
    errorMsg = null;
    isRequired = settings.show_hide_address_fields !== 'show';
    countryCode = form.country.value;

    init() {
        if (settings.change_fields_position) {
            const countryField = form.country.closest('.field');

            countryField.classList.add('col-span-full');
            this.$el.before(countryField);
        }

        form.country.addEventListener('change', (e) => {
            this.countryCode = e.target.value;
            this.isNl = this.countryCode === 'NL';
            this.errorMsg = null;
            this.formattedAddress = null;

            const showAddressFields = !settings.enabled_countries.includes(this.countryCode);

            this.toggleFields(showAddressFields, showAddressFields);
        });

        this.$nextTick(() => {
            form.classList.add('address-autofill-enabled');
        });
    }

    resetInputAddress() {
        getAddressInputs().forEach((input) => { input.value = ''; });
    }

    isFieldValid(name) {
        return this.fields[name].state.valid && this.fields[name].element.value.trim() !== '';
    }

    toggleFields(state, force = false) {
        if (settings.show_hide_address_fields === 'show') {
            return;
        }

        // show_hide_address_fields will be either 'show' or 'format',
        // with 'format' only show fields when force flag is true.
        state = force && state;

        getAddressInputs().filter((el) => ![form.region, form.region_id].includes(el)).forEach((el) => {
            el.setAttribute('data-validate-hidden', !state); // Keep validating hidden elements.
        });

        for (const name of ['street', 'postcode', 'city']) {
            fields[name].style.display = state ? 'block' : 'none';
        }
    }
}

<?php

namespace PostcodeEu\AddressValidationHyva\ViewModel;

use Magento\Framework\View\Element\Block\ArgumentInterface;
use PostcodeEu\AddressValidation\Helper\StoreConfigHelper;
use PostcodeEu\AddressValidation\Helper\Data as DataHelper;
use PostcodeEu\AddressValidation\Model\Config\Source\ShowHideAddressFields;

class AddressAutofill implements ArgumentInterface
{
    public function __construct(
        public readonly StoreConfigHelper $storeConfigHelper,
        public readonly DataHelper $dataHelper
    ) {
    }

    /**
     * Check if address fields should be hidden initially.
     *
     * @return bool
     */
    public function isHideFields(): bool {
        $mode = $this->storeConfigHelper->getValue('show_hide_address_fields');
        return $mode === ShowHideAddressFields::FORMAT || $mode === ShowHideAddressFields::HIDE;
    }
}

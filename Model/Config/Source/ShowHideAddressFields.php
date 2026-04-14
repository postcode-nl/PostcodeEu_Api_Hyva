<?php

namespace PostcodeEu\AddressValidationHyva\Model\Config\Source;

class ShowHideAddressFields extends \PostcodeEu\AddressValidation\Model\Config\Source\ShowHideAddressFields
{
    /**
     * @inheritdoc
     */
    public function toOptionArray(): array
    {
        return array_filter(
            parent::toOptionArray(),
            fn ($option) => in_array($option['value'], [static::FORMAT, static::SHOW])
        );
    }
}

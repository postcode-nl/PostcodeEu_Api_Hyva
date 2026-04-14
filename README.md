## Hyvä Theme Compatibility module for Postcode.eu Address Validation

This module adds Hyvä Theme compatibility for the [address validation module by Postcode.eu](https://github.com/postcode-nl/PostcodeNl_Api_Magento2).

*Please note that Hyvä Checkout is currently not supported.*

## Installation instructions

Install this module using Composer:

```bash
composer require postcode-eu/magento2-hyva-address-validation
bin/magento setup:upgrade
bin/magento setup:di:compile
bin/magento cache:flush
```

## License

The code is available under the Simplified BSD License, see the included LICENSE file.

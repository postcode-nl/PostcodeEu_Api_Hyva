const translations = JSON.parse(document.getElementById('postcode-eu-translations').textContent),
    settings = JSON.parse(document.getElementById('postcode-eu-settings').textContent),
    t = (id) => translations[id];

export { t, settings };

export function extractHouseNumber(streetAndHouseNumber) {
    const matches = [...streetAndHouseNumber.matchAll(/[1-9]\d{0,4}\D*/g)];

    if (matches[0]?.index === 0) {
        matches.shift(); // Discard leading number as a valid house number.
    }

    if (matches.length === 1) {
        return matches[0][0].trim(); // Single match is most likely the house number.
    }

    return null; // No match or ambiguous (i.e. multiple numbers found).
}

function validateAddress(country, streetAndBuilding, postcode, locality) {
    const params = [
            'streetAndBuilding=' + encodeURIComponent(streetAndBuilding ?? ''),
            'postcode=' + encodeURIComponent(postcode ?? ''),
            'locality=' + encodeURIComponent(locality ?? ''),
            'form_key=' + settings.form_key,
        ].join('&'),
        url = `${settings.api_actions.validate}/${country}?${params}`;

    return fetch(url, {headers: {'X-Requested-With': 'XMLHttpRequest'}}).then((response) => {
        if (response.ok) {
            return response.json();
        }

        throw new Error(response.statusText);
    });
}

export function getValidatedAddress(country, streetAndBuilding, postcode, locality) {
    return validateAddress(country, streetAndBuilding, postcode, locality)
        .then(([response]) => {
            const top = response.matches[0];

            if (
                top?.status
                && !top.status.isAmbiguous
                && top.status.grade < 'C'
                && ['Building', 'BuildingPartial'].includes(top.status.validationLevel)
            ) {
                return top;
            }

            return null;
        })
        .catch((error) => {
            console.error(error);
            return null;
        });
}

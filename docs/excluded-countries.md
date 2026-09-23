# Excluded places

Every sovereign country (193 UN members plus Vatican City, Palestine, Kosovo and Taiwan) is playable, including micro-states. Tiny ones (land < 1,000 km²) trigger a "difficult round" warning when they are the secret.

The places below are **not** countries in this game. Typing one shows an explanation and does not count as a guess. Most are still drawn on the globe as plain land. The source of truth is `src/data/excluded.ts`, and `src/data/countries.test.ts` checks that this table matches it.

A handful of overseas regions aren't drawn as separate land at all: in Natural Earth's admin-0 boundaries, France's feature includes French Guiana, Guadeloupe, Martinique, Réunion and Mayotte, and the Netherlands' feature includes the Caribbean Netherlands (Bonaire, Sint Eustatius, Saba). Those areas are coloured and counted as part of France or the Netherlands for guessing purposes — guessing France also colours French Guiana, and a France guess can land 0 km from Brazil or Suriname — even though typing the overseas region's own name still shows the "not a country" message above.

| Name | Why it's excluded |
|---|---|
| Greenland | a territory of Denmark |
| Faroe Islands | a territory of Denmark |
| Åland Islands | an autonomous region of Finland |
| Puerto Rico | a territory of the United States |
| Guam | a territory of the United States |
| US Virgin Islands | a territory of the United States |
| American Samoa | a territory of the United States |
| Northern Mariana Islands | a territory of the United States |
| Falkland Islands | a territory of the United Kingdom |
| Bermuda | a territory of the United Kingdom |
| Cayman Islands | a territory of the United Kingdom |
| British Virgin Islands | a territory of the United Kingdom |
| Turks and Caicos Islands | a territory of the United Kingdom |
| Anguilla | a territory of the United Kingdom |
| Montserrat | a territory of the United Kingdom |
| Saint Helena | a territory of the United Kingdom |
| Pitcairn Islands | a territory of the United Kingdom |
| South Georgia | a territory of the United Kingdom |
| British Indian Ocean Territory | a territory of the United Kingdom |
| Jersey | a British Crown Dependency |
| Guernsey | a British Crown Dependency |
| Isle of Man | a British Crown Dependency |
| French Polynesia | a territory of France |
| New Caledonia | a territory of France |
| Wallis and Futuna | a territory of France |
| Saint Pierre and Miquelon | a territory of France |
| Saint Martin | a territory of France |
| Saint Barthélemy | a territory of France |
| French Southern and Antarctic Lands | a territory of France |
| French Guiana | an overseas region of France |
| Réunion | an overseas region of France |
| Guadeloupe | an overseas region of France |
| Martinique | an overseas region of France |
| Mayotte | an overseas region of France |
| Aruba | part of the Kingdom of the Netherlands |
| Curaçao | part of the Kingdom of the Netherlands |
| Sint Maarten | part of the Kingdom of the Netherlands |
| Cook Islands | in free association with New Zealand |
| Niue | in free association with New Zealand |
| Hong Kong | a special administrative region of China |
| Macau | a special administrative region of China |
| Norfolk Island | a territory of Australia |
| Christmas Island | a territory of Australia |
| Cocos Islands | a territory of Australia |
| Heard Island and McDonald Islands | a territory of Australia |
| Western Sahara | a disputed territory |
| Somaliland | counted as part of Somalia (its shape is merged into Somalia) |
| Northern Cyprus | counted as part of Cyprus (its shape is merged into Cyprus) |
| Antarctica | a continent |

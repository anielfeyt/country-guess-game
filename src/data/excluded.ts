/** Places a player may type that are recognised but are not countries in this game. */
export interface ExcludedEntry {
  name: string;
  aliases: string[];
  /** Completes the sentence "X isn't a country in this game — it's …". */
  reason: string;
}

const US = "a territory of the United States";
const UK = "a territory of the United Kingdom";
const UK_CROWN = "a British Crown Dependency";
const FR = "a territory of France";
const FR_REGION = "an overseas region of France";
const NL = "part of the Kingdom of the Netherlands";
const NZ = "in free association with New Zealand";
const AU = "a territory of Australia";
const CN = "a special administrative region of China";
const DK = "a territory of Denmark";

export const EXCLUDED: ExcludedEntry[] = [
  { name: "Greenland", aliases: [], reason: DK },
  { name: "Faroe Islands", aliases: ["Faroes", "Faeroe Islands"], reason: DK },
  { name: "Åland Islands", aliases: ["Aland", "Åland"], reason: "an autonomous region of Finland" },
  { name: "Puerto Rico", aliases: [], reason: US },
  { name: "Guam", aliases: [], reason: US },
  { name: "US Virgin Islands", aliases: ["United States Virgin Islands"], reason: US },
  { name: "American Samoa", aliases: [], reason: US },
  { name: "Northern Mariana Islands", aliases: [], reason: US },
  { name: "Falkland Islands", aliases: ["Falklands", "Malvinas"], reason: UK },
  { name: "Bermuda", aliases: [], reason: UK },
  { name: "Cayman Islands", aliases: [], reason: UK },
  { name: "British Virgin Islands", aliases: [], reason: UK },
  { name: "Turks and Caicos Islands", aliases: ["Turks and Caicos"], reason: UK },
  { name: "Anguilla", aliases: [], reason: UK },
  { name: "Montserrat", aliases: [], reason: UK },
  { name: "Saint Helena", aliases: [], reason: UK },
  { name: "Pitcairn Islands", aliases: [], reason: UK },
  { name: "South Georgia", aliases: ["South Georgia and the South Sandwich Islands"], reason: UK },
  { name: "British Indian Ocean Territory", aliases: ["Chagos Islands"], reason: UK },
  { name: "Jersey", aliases: [], reason: UK_CROWN },
  { name: "Guernsey", aliases: [], reason: UK_CROWN },
  { name: "Isle of Man", aliases: [], reason: UK_CROWN },
  { name: "French Polynesia", aliases: ["Tahiti"], reason: FR },
  { name: "New Caledonia", aliases: [], reason: FR },
  { name: "Wallis and Futuna", aliases: [], reason: FR },
  { name: "Saint Pierre and Miquelon", aliases: [], reason: FR },
  { name: "Saint Martin", aliases: [], reason: FR },
  { name: "Saint Barthélemy", aliases: ["St Barts"], reason: FR },
  { name: "French Southern and Antarctic Lands", aliases: [], reason: FR },
  { name: "French Guiana", aliases: [], reason: FR_REGION },
  { name: "Réunion", aliases: [], reason: FR_REGION },
  { name: "Guadeloupe", aliases: [], reason: FR_REGION },
  { name: "Martinique", aliases: [], reason: FR_REGION },
  { name: "Mayotte", aliases: [], reason: FR_REGION },
  { name: "Aruba", aliases: [], reason: NL },
  { name: "Curaçao", aliases: [], reason: NL },
  { name: "Sint Maarten", aliases: [], reason: NL },
  { name: "Cook Islands", aliases: [], reason: NZ },
  { name: "Niue", aliases: [], reason: NZ },
  { name: "Hong Kong", aliases: [], reason: CN },
  { name: "Macau", aliases: ["Macao"], reason: CN },
  { name: "Norfolk Island", aliases: [], reason: AU },
  { name: "Christmas Island", aliases: [], reason: AU },
  { name: "Cocos Islands", aliases: ["Cocos (Keeling) Islands", "Keeling Islands"], reason: AU },
  { name: "Heard Island and McDonald Islands", aliases: [], reason: AU },
  { name: "Western Sahara", aliases: [], reason: "a disputed territory" },
  { name: "Somaliland", aliases: [], reason: "counted as part of Somalia" },
  { name: "Northern Cyprus", aliases: [], reason: "counted as part of Cyprus" },
  { name: "Antarctica", aliases: [], reason: "a continent" },
];

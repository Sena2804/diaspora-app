/**
 * Pays supportés à l'inscription, avec leurs indicatifs téléphoniques,
 * leur format de numéro et les types de documents d'identité acceptés.
 *
 * La validation est volontairement permissive (longueurs + caractères de base) :
 * on bloque les saisies évidemment fausses sans casser la tête à l'utilisateur
 * sur des formats régionaux nuancés.
 */

export interface DocumentType {
  code: 'NPI' | 'CIN' | 'PASSPORT' | 'RESIDENCE_PERMIT' | 'DRIVER_LICENSE';
  label: string;
  /** Indication à afficher dans le champ pour aider la saisie. */
  placeholder: string;
  /** Validation côté client (regex). On garde des règles simples. */
  regex: RegExp;
  helpText: string;
}

export interface Country {
  code: string;        // ISO 3166-1 alpha-2
  name: string;
  flag: string;        // Emoji drapeau
  dialCode: string;    // ex. "+229"
  /** Format attendu du numéro local (après l'indicatif). */
  phoneRegex: RegExp;
  phonePlaceholder: string;
  phoneHelp: string;
  /** Types de documents acceptés pour ce pays. Le premier est le défaut. */
  documents: DocumentType[];
}

// Documents communs (passeport, titre de séjour) — réutilisés dans plusieurs pays.
const PASSPORT: DocumentType = {
  code: 'PASSPORT',
  label: 'Passeport',
  placeholder: 'Numéro du passeport',
  regex: /^[A-Z0-9]{6,12}$/i,
  helpText: '6 à 12 caractères alphanumériques.',
};

const RESIDENCE_PERMIT: DocumentType = {
  code: 'RESIDENCE_PERMIT',
  label: 'Titre / Carte de séjour',
  placeholder: 'Numéro de la carte',
  regex: /^[A-Z0-9-]{6,15}$/i,
  helpText: '6 à 15 caractères alphanumériques.',
};

// =============================================================================
// Liste des pays — Bénin en tête (cible principale).
// =============================================================================
export const COUNTRIES: Country[] = [
  {
    code: 'BJ',
    name: 'Bénin',
    flag: '🇧🇯',
    dialCode: '+229',
    // Nouveau plan de numérotation Bénin (2024) : tous les numéros mobiles
    // commencent par 01 suivi de 8 chiffres = 10 chiffres au total.
    phoneRegex: /^01\d{8}$/,
    phonePlaceholder: '01XXXXXXXX',
    phoneHelp: '10 chiffres, commençant par 01 (nouveau plan 2024).',
    documents: [
      {
        code: 'NPI',
        label: 'NPI (Numéro Personnel d\'Identification)',
        placeholder: '10 chiffres',
        regex: /^\d{10}$/,
        helpText: 'Le NPI est composé de 10 chiffres (figure sur ta CIP).',
      },
      {
        code: 'CIN',
        label: 'CIP / Carte Nationale d\'Identité',
        placeholder: 'Numéro de la CIP',
        regex: /^[A-Z0-9-]{6,15}$/i,
        helpText: '6 à 15 caractères, tel qu\'imprimé sur la carte.',
      },
      PASSPORT,
    ],
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    dialCode: '+33',
    phoneRegex: /^[67]\d{8}$/,
    phonePlaceholder: '6XXXXXXXX',
    phoneHelp: '9 chiffres après l\'indicatif, commençant par 6 ou 7.',
    documents: [
      {
        code: 'CIN',
        label: 'Carte Nationale d\'Identité (FR)',
        placeholder: '12 caractères',
        regex: /^[A-Z0-9]{12}$/i,
        helpText: '12 caractères alphanumériques (au dos de la carte).',
      },
      PASSPORT,
      RESIDENCE_PERMIT,
    ],
  },
  {
    code: 'CI',
    name: 'Côte d\'Ivoire',
    flag: '🇨🇮',
    dialCode: '+225',
    phoneRegex: /^0[1-7]\d{8}$/,
    phonePlaceholder: '07XXXXXXXX',
    phoneHelp: '10 chiffres au total, commençant par 0.',
    documents: [
      { code: 'CIN', label: 'CNI ivoirienne', placeholder: 'Numéro de la CNI', regex: /^[A-Z0-9]{8,15}$/i, helpText: '8 à 15 caractères.' },
      PASSPORT,
    ],
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    dialCode: '+234',
    phoneRegex: /^[789]\d{9}$/,
    phonePlaceholder: '8XXXXXXXXX',
    phoneHelp: '10 chiffres après l\'indicatif.',
    documents: [
      { code: 'CIN', label: 'NIN (National ID)', placeholder: '11 chiffres', regex: /^\d{11}$/, helpText: '11 chiffres.' },
      PASSPORT,
    ],
  },
  {
    code: 'TG',
    name: 'Togo',
    flag: '🇹🇬',
    dialCode: '+228',
    phoneRegex: /^\d{8}$/,
    phonePlaceholder: '9XXXXXXX',
    phoneHelp: '8 chiffres.',
    documents: [
      { code: 'CIN', label: 'CNI togolaise', placeholder: 'Numéro de la CNI', regex: /^[A-Z0-9-]{6,15}$/i, helpText: '6 à 15 caractères.' },
      PASSPORT,
    ],
  },
  {
    code: 'SN',
    name: 'Sénégal',
    flag: '🇸🇳',
    dialCode: '+221',
    phoneRegex: /^7[05678]\d{7}$/,
    phonePlaceholder: '7XXXXXXXX',
    phoneHelp: '9 chiffres, commençant par 7.',
    documents: [
      { code: 'CIN', label: 'CNI sénégalaise', placeholder: 'Numéro de la CNI', regex: /^\d{13,17}$/, helpText: '13 à 17 chiffres.' },
      PASSPORT,
    ],
  },
  {
    code: 'GA',
    name: 'Gabon',
    flag: '🇬🇦',
    dialCode: '+241',
    phoneRegex: /^0[1-7]\d{6,7}$/,
    phonePlaceholder: '0XXXXXXX',
    phoneHelp: '8 à 9 chiffres.',
    documents: [
      { code: 'CIN', label: 'CNI gabonaise', placeholder: 'Numéro de la CNI', regex: /^[A-Z0-9-]{6,15}$/i, helpText: '6 à 15 caractères.' },
      PASSPORT,
    ],
  },
  {
    code: 'BE',
    name: 'Belgique',
    flag: '🇧🇪',
    dialCode: '+32',
    phoneRegex: /^4\d{8}$/,
    phonePlaceholder: '4XXXXXXXX',
    phoneHelp: '9 chiffres, commençant par 4 (mobile).',
    documents: [
      { code: 'CIN', label: 'eID belge', placeholder: 'Numéro de la carte eID', regex: /^[A-Z0-9-]{8,15}$/i, helpText: '8 à 15 caractères.' },
      PASSPORT,
      RESIDENCE_PERMIT,
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    dialCode: '+1',
    phoneRegex: /^[2-9]\d{9}$/,
    phonePlaceholder: '514XXXXXXX',
    phoneHelp: '10 chiffres.',
    documents: [
      PASSPORT,
      { code: 'DRIVER_LICENSE', label: 'Permis de conduire', placeholder: 'Numéro du permis', regex: /^[A-Z0-9-]{5,15}$/i, helpText: '5 à 15 caractères.' },
      RESIDENCE_PERMIT,
    ],
  },
  {
    code: 'US',
    name: 'États-Unis',
    flag: '🇺🇸',
    dialCode: '+1',
    phoneRegex: /^[2-9]\d{9}$/,
    phonePlaceholder: '202XXXXXXX',
    phoneHelp: '10 chiffres.',
    documents: [
      PASSPORT,
      { code: 'DRIVER_LICENSE', label: 'Driver\'s License', placeholder: 'Numéro du permis', regex: /^[A-Z0-9-]{5,15}$/i, helpText: '5 à 15 caractères.' },
      RESIDENCE_PERMIT,
    ],
  },
  {
    code: 'GB',
    name: 'Royaume-Uni',
    flag: '🇬🇧',
    dialCode: '+44',
    phoneRegex: /^7\d{9}$/,
    phonePlaceholder: '7XXXXXXXXX',
    phoneHelp: '10 chiffres, commençant par 7.',
    documents: [PASSPORT, RESIDENCE_PERMIT],
  },
  {
    code: 'DE',
    name: 'Allemagne',
    flag: '🇩🇪',
    dialCode: '+49',
    phoneRegex: /^1[567]\d{7,9}$/,
    phonePlaceholder: '15XXXXXXXX',
    phoneHelp: '10 à 11 chiffres après l\'indicatif.',
    documents: [
      { code: 'CIN', label: 'Personalausweis', placeholder: 'Numéro CI allemande', regex: /^[A-Z0-9]{9,10}$/i, helpText: '9 à 10 caractères.' },
      PASSPORT,
      RESIDENCE_PERMIT,
    ],
  },
  {
    code: 'IT',
    name: 'Italie',
    flag: '🇮🇹',
    dialCode: '+39',
    phoneRegex: /^3\d{8,9}$/,
    phonePlaceholder: '3XXXXXXXXX',
    phoneHelp: '9 à 10 chiffres, commençant par 3.',
    documents: [
      { code: 'CIN', label: 'Carta d\'Identità', placeholder: 'Numéro CI', regex: /^[A-Z0-9]{7,12}$/i, helpText: '7 à 12 caractères.' },
      PASSPORT,
      RESIDENCE_PERMIT,
    ],
  },
  {
    code: 'ES',
    name: 'Espagne',
    flag: '🇪🇸',
    dialCode: '+34',
    phoneRegex: /^[67]\d{8}$/,
    phonePlaceholder: '6XXXXXXXX',
    phoneHelp: '9 chiffres, commençant par 6 ou 7.',
    documents: [
      { code: 'CIN', label: 'DNI / NIE', placeholder: 'DNI ou NIE', regex: /^[A-Z0-9]{8,10}$/i, helpText: '8 à 10 caractères.' },
      PASSPORT,
      RESIDENCE_PERMIT,
    ],
  },
  {
    code: 'CH',
    name: 'Suisse',
    flag: '🇨🇭',
    dialCode: '+41',
    phoneRegex: /^7[5-9]\d{7}$/,
    phonePlaceholder: '7XXXXXXXX',
    phoneHelp: '9 chiffres, commençant par 7.',
    documents: [PASSPORT, RESIDENCE_PERMIT],
  },
  {
    code: 'NL',
    name: 'Pays-Bas',
    flag: '🇳🇱',
    dialCode: '+31',
    phoneRegex: /^6\d{8}$/,
    phonePlaceholder: '6XXXXXXXX',
    phoneHelp: '9 chiffres, commençant par 6.',
    documents: [PASSPORT, RESIDENCE_PERMIT],
  },
  {
    code: 'PT',
    name: 'Portugal',
    flag: '🇵🇹',
    dialCode: '+351',
    phoneRegex: /^9[1236]\d{7}$/,
    phonePlaceholder: '9XXXXXXXX',
    phoneHelp: '9 chiffres, commençant par 9.',
    documents: [PASSPORT, RESIDENCE_PERMIT],
  },
];

export function findCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/**
 * Renvoie le numéro stocké (e.g. "+22901234567") à partir du local saisi
 * et du pays sélectionné. Strippe espaces/tirets.
 */
export function buildFullPhone(country: Country, local: string): string {
  return `${country.dialCode}${local.replace(/[\s-]/g, '')}`;
}

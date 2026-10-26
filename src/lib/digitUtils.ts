/**
 * Utility functions for handling Bengali and English digits and text normalization
 */

// Maps Bengali digits to English digits
const bengaliToEnglishMap: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

// Arabic-Indic digits (sometimes pasted from phone keyboards)
const arabicIndicToEnglishMap: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

// Maps English digits to Bengali digits
const englishToBengaliMap: Record<string, string> = {
  '0': '০', '1': '১', '2': '২', '3': '৩', '4': '৪',
  '5': '৫', '6': '৬', '7': '৭', '8': '৮', '9': '৯'
};

/**
 * Converts Bengali (and Arabic-Indic) digits in a string to English digits.
 * Preserves all other characters (letters, spaces, special chars).
 */
export function convertBengaliToEnglish(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/[০-৯]/g, (char) => bengaliToEnglishMap[char] || char)
    .replace(/[٠-٩]/g, (char) => arabicIndicToEnglishMap[char] || char);
}

/**
 * Converts English digits in a string to Bengali digits.
 * Preserves all other characters (letters, spaces, special chars).
 */
export function convertEnglishToBengali(input: unknown): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[0-9]/g, (char) => englishToBengaliMap[char] || char);
}

/**
 * Parses a string or number containing Bengali or English digits into a float number.
 * Returns NaN if the input cannot be parsed as a number.
 */
export function parseNumberWithBengaliSupport(input: unknown): number {
  if (typeof input === 'number') return input;
  if (input === null || input === undefined) return NaN;
  const englishOnly = convertBengaliToEnglish(String(input)).trim();
  if (englishOnly === '') return NaN;
  return parseFloat(englishOnly);
}

/**
 * Normalizes a string for comparison by:
 * 1. Handling null/undefined safely
 * 2. Normalizing Unicode to NFC (resolves Avro/Bijoy/phonetic composing differences)
 * 3. Converting Bengali/Arabic-Indic digits to English digits
 * 4. Lowercasing and trimming
 */
export function normalizeForComparison(input: unknown): string {
  if (input === null || input === undefined) return '';
  const str = String(input).normalize('NFC').trim().toLowerCase();
  return convertBengaliToEnglish(str);
}

/**
 * Normalizes a Bangladesh mobile number (Bengali/English digits, spaces, dashes,
 * "+880" prefix) to the 880XXXXXXXXXX form SMS providers expect.
 * Returns null when the value is not a valid Bangladesh mobile number.
 * Shared by the browser and the SMS server function so both validate identically.
 */
export function formatBangladeshMobile(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const digits = convertBengaliToEnglish(value).replace(/\D/g, '');
  if (/^01[3-9]\d{8}$/.test(digits)) return `880${digits.slice(1)}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  return null;
}

/** Digits-only form of a value (after Bengali/Arabic digit conversion). */
export function digitsOnly(input: unknown): string {
  return normalizeForComparison(input).replace(/\D+/g, '');
}

/**
 * Shared student search matcher used across Fees / Hifz / Summary / Certificate / Picker.
 * Matches name, id, roll, and contact; also matches digit-only forms so
 * "017-1234" finds "01712345678" and Bengali rolls/phones match English typing.
 */
export function studentMatchesQuery(
  student: {
    name?: unknown;
    banglaName?: unknown;
    id?: unknown;
    studentId?: unknown;
    roll?: unknown;
    rollNumber?: unknown;
    contact?: unknown;
    phone?: unknown;
    class?: unknown;
    fatherName?: unknown;
    motherName?: unknown;
    extraInfo?: unknown;
  },
  rawQuery: unknown
): boolean {
  const term = normalizeForComparison(rawQuery);
  if (!term) return true;

  const fields = [
    student.name,
    student.banglaName,
    student.id,
    student.studentId,
    student.roll,
    student.rollNumber,
    student.contact,
    student.phone,
    student.class,
    student.fatherName,
    student.motherName,
    student.extraInfo,
  ];
  if (fields.some((f) => normalizeForComparison(f).includes(term))) return true;

  const termDigits = term.replace(/\D+/g, '');
  if (termDigits.length > 0) {
    if (fields.some((f) => digitsOnly(f).includes(termDigits))) return true;
  }

  return false;
}

/**
 * Strict class equality checker that normalizes Unicode and trims whitespace.
 */
export function isClassMatch(studentClass: unknown, filterClass: string): boolean {
  if (!filterClass || filterClass === 'All') return true;
  const c1 = String(studentClass || '').normalize('NFC').trim();
  const c2 = String(filterClass || '').normalize('NFC').trim();
  return c1 === c2;
}

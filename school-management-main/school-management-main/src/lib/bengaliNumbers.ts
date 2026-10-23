/**
 * Bengali numeral and number-to-words conversion utilities.
 * Converts English digits (0-9) to Bengali script digits and numbers to Bengali words.
 */

// Bengali digit mapping
const BENGALI_DIGITS: Record<string, string> = {
  '0': '০',
  '1': '১',
  '2': '২',
  '3': '৩',
  '4': '৪',
  '5': '৫',
  '6': '৬',
  '7': '৭',
  '8': '৮',
  '9': '৯',
};

// Bengali place names
const ONES: string[] = [
  'শূন্য', 'এক', 'দুই', 'তিন', 'চার', 'পাঁচ', 'ছয়', 'সাত', 'আট', 'নয়',
  'দশ', 'এগারো', 'বারো', 'তেরো', 'চৌদ্দ', 'পনেরো', 'ষোল', 'সতেরো', 'আঠারো', 'উনিশ',
  'বিশ', 'একুশ', 'বাইশ', 'তেইশ', 'চব্বিশ', 'পঁচিশ', 'ছাব্বিশ', 'সাতাশ', 'আঠাশ', 'উনত্রিশ',
  'ত্রিশ', 'একত্রিশ', 'বত্রিশ', 'তেত্রিশ', 'চৌত্রিশ', 'পঁয়ত্রিশ', 'ছত্রিশ', 'সাইত্রিশ', 'আটত্রিশ', 'উনচল্লিশ',
  'চল্লিশ', 'একচল্লিশ', 'বিয়াল্লিশ', 'তেতাল্লিশ', 'চুয়াল্লিশ', 'পঁয়তাল্লিশ', 'ছেচল্লিশ', 'সাতচল্লিশ', 'আটচল্লিশ', 'উনপঞ্চাশ',
  'পঞ্চাশ', 'একান্ন', 'বায়ান্ন', 'তিপ্পান্ন', 'চুয়ান্ন', 'পঞ্চান্ন', 'ছাপ্পান্ন', 'সাতান্ন', 'আটান্ন', 'উনষাট',
  'ষাট', 'একষট্টি', 'বাষট্টি', 'তেষট্টি', 'চৌষট্টি', 'পঁয়ষট্টি', 'ছেষট্টি', 'সাতষট্টি', 'আটষট্টি', 'উনসত্তর',
  'সত্তর', 'একাত্তর', 'বাহাত্তর', 'তিয়াত্তর', 'চুয়াত্তর', 'পঁচাত্তর', 'ছিয়াত্তর', 'সাতাত্তর', 'আটাত্তর', 'উনাশি',
  'আশি', 'একাশি', 'বিরাশি', 'তিরাশি', 'চুরাশি', 'পঁচাশি', 'ছিয়াশি', 'সাতাশি', 'আটাশি', 'উননব্বই',
  'নব্বই', 'একানব্বই', 'বিরানব্বই', 'তিরানব্বই', 'চুরানব্বই', 'পঁচানব্বই', 'ছিয়ানব্বই', 'সাতানব্বই', 'আটানব্বই', 'নিরানব্বই',
];

/**
 * Converts an English digit string to Bengali digits.
 * e.g., "500" -> "৫০০", "1234" -> "১২৩৪"
 */
export function toBengaliDigits(num: number | string): string {
  const str = typeof num === 'number' ? num.toFixed(0) : num;
  return str.replace(/\d/g, d => BENGALI_DIGITS[d] || d);
}

/**
 * Formats a number with Bengali digits and 2 decimal places for Taka.
 * e.g., 500 -> "৫০০.০০", 1234.50 -> "১২৩৪.৫০"
 */
export function formatTakaBengali(amount: number): string {
  const parts = amount.toFixed(2).split('.');
  const integerPart = parts[0].replace(/\d/g, d => BENGALI_DIGITS[d] || d);
  const decimalPart = parts[1].replace(/\d/g, d => BENGALI_DIGITS[d] || d);
  return `${integerPart}.${decimalPart}`;
}

/**
 * Converts a number (up to 99,99,999) to Bengali words.
 * Uses the Indian/Bengali numbering system (লাখ, কোটি).
 * e.g., 500 -> "পাঁচশত টাকা", 1234 -> "এক হাজার দুইশত চৌত্রিশ টাকা"
 */
export function numberToBengaliWords(num: number): string {
  if (num === 0) return 'শূন্য টাকা';
  if (num < 0) return 'ঋণাত্মক';

  const numInt = Math.floor(num);

  // For numbers in the ones range, use the lookup table
  if (numInt < 100) {
    return ONES[numInt] + ' টাকা';
  }

  // For 100-999: "Xশত Y"
  if (numInt < 1000) {
    const hundreds = Math.floor(numInt / 100);
    const remainder = numInt % 100;
    let result = ONES[hundreds] + 'শত';
    if (remainder > 0) {
      result += ' ' + ONES[remainder];
    }
    return result + ' টাকা';
  }

  // For 1000-99999: "X হাজার Y"
  if (numInt < 100000) {
    const thousands = Math.floor(numInt / 1000);
    const remainder = numInt % 1000;
    let result = (thousands < 100 ? ONES[thousands] : numberToBengaliWordsShort(thousands)) + ' হাজার';
    if (remainder > 0) {
      result += ' ' + (remainder < 100 ? ONES[remainder] : numberToBengaliWordsShort(remainder));
    }
    return result + ' টাকা';
  }

  // For 100000-9999999: "X লাখ Y"
  if (numInt < 10000000) {
    const lakh = Math.floor(numInt / 100000);
    const remainder = numInt % 100000;
    let result = (lakh < 100 ? ONES[lakh] : numberToBengaliWordsShort(lakh)) + ' লাখ';
    if (remainder > 0) {
      result += ' ' + numberToBengaliWordsShort(remainder);
    }
    return result + ' টাকা';
  }

  // For 10000000+: "X কোটি Y"
  const crore = Math.floor(numInt / 10000000);
  const remainder = numInt % 10000000;
  let result = (crore < 100 ? ONES[crore] : numberToBengaliWordsShort(crore)) + ' কোটি';
  if (remainder > 0) {
    result += ' ' + numberToBengaliWordsShort(remainder);
  }
  return result + ' টাকা';
}

/**
 * Internal helper: converts number to Bengali words without appending "টাকা".
 * Handles numbers up to 99999999.
 */
function numberToBengaliWordsShort(num: number): string {
  if (num === 0) return 'শূন্য';
  if (num < 100) return ONES[num];

  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const remainder = num % 100;
    let result = ONES[hundreds] + 'শত';
    if (remainder > 0) result += ' ' + ONES[remainder];
    return result;
  }

  if (num < 100000) {
    const thousands = Math.floor(num / 1000);
    const remainder = num % 1000;
    let result = (thousands < 100 ? ONES[thousands] : numberToBengaliWordsShort(thousands)) + ' হাজার';
    if (remainder > 0) result += ' ' + numberToBengaliWordsShort(remainder);
    return result;
  }

  if (num < 10000000) {
    const lakh = Math.floor(num / 100000);
    const remainder = num % 100000;
    let result = (lakh < 100 ? ONES[lakh] : numberToBengaliWordsShort(lakh)) + ' লাখ';
    if (remainder > 0) result += ' ' + numberToBengaliWordsShort(remainder);
    return result;
  }

  const crore = Math.floor(num / 10000000);
  const remainder = num % 10000000;
  let result = (crore < 100 ? ONES[crore] : numberToBengaliWordsShort(crore)) + ' কোটি';
  if (remainder > 0) result += ' ' + numberToBengaliWordsShort(remainder);
  return result;
}

/**
 * Converts a number to its Bengali word representation and formats the whole string
 * including Bengali digits for the numeric value.
 * e.g., 500 -> "পাঁচশত টাকা (৫০০.০০ টাকা)"
 */
export function formatTakaWithWords(amount: number): string {
  const words = numberToBengaliWords(amount);
  const digits = formatTakaBengali(amount);
  return `${words} (${digits} টাকা)`;
}

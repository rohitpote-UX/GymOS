/**
 * Multilingual formatters for Indian Gym Business OS.
 * Supports English (en-IN), Marathi (mr-IN), and Hindi (hi-IN).
 */

const LOCALE_MAP: Record<string, string> = {
  en: 'en-IN',
  mr: 'mr-IN',
  hi: 'hi-IN',
};

/**
 * Format currency with Indian Rupee symbol and Indian numbering system (e.g. ₹1,25,000.00)
 */
export function formatCurrency(amount: number | string | null | undefined, lang: string = 'en'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  if (isNaN(num)) return '₹0.00';

  const intlLocale = LOCALE_MAP[lang] || 'en-IN';

  try {
    return new Intl.NumberFormat(intlLocale, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

/**
 * Format numbers with Indian commas (e.g. 1,50,000)
 */
export function formatNumber(num: number | string | null | undefined, lang: string = 'en'): string {
  const val = typeof num === 'string' ? parseFloat(num) : (num ?? 0);
  if (isNaN(val)) return '0';

  const intlLocale = LOCALE_MAP[lang] || 'en-IN';
  try {
    return new Intl.NumberFormat(intlLocale).format(val);
  } catch {
    return val.toLocaleString('en-IN');
  }
}

/**
 * Localized date formatter (e.g., 18 Nov 2026 / १८ नोव्हेंबर २०२६ / १८ नवंबर २०२६)
 */
export function formatDate(
  dateInput: string | Date | null | undefined,
  lang: string = 'en',
  options?: Intl.DateTimeFormatOptions
): string {
  if (!dateInput) return '—';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  const intlLocale = LOCALE_MAP[lang] || 'en-IN';
  const defaultOptions: Intl.DateTimeFormatOptions = options || {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  };

  try {
    return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(date);
  } catch {
    return date.toLocaleDateString('en-IN');
  }
}

/**
 * Format date & time (e.g. 18 Nov 2026, 09:30 AM)
 */
export function formatDateTime(
  dateInput: string | Date | null | undefined,
  lang: string = 'en'
): string {
  if (!dateInput) return '—';
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) return '—';

  const intlLocale = LOCALE_MAP[lang] || 'en-IN';
  try {
    return new Intl.DateTimeFormat(intlLocale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return date.toLocaleString('en-IN');
  }
}

/**
 * Normalize mobile numbers, especially Indian (+91, spaces, hyphens, leading 0)
 */
export function normalizePhoneNumber(raw: string | null | undefined): string {
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  // If Indian mobile number starts with 91 and has 12 digits (e.g. 919822011223)
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  }
  // If starts with leading 0 (e.g. 09822011223)
  if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Split full contact name into first and last name tokens safely
 */
export function parseContactName(rawName: string | null | undefined): { firstName: string; lastName: string } {
  if (!rawName) return { firstName: '', lastName: '' };
  const parts = rawName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
  return { firstName, lastName };
}


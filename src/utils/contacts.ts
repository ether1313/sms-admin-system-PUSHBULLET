export interface ParsedContact {
  phone: string;
  name?: string;
}

/**
 * Parse contacts from textarea input
 * Each line: phone OR phone + space + name
 */
export function parseContacts(input: string): ParsedContact[] {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const contacts: ParsedContact[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    const phone = normalizePhone(parts[0]);

    if (phone) {
      contacts.push({
        phone,
        name: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
      });
    }
  }

  return contacts;
}

/**
 * Normalize phone number to E.164 for multi-country support.
 * Accepted input examples:
 * - +61412345678
 * - 61412345678 (country code included without +, same as before for AU)
 * - +60123456789 / 60123456789
 * - 0060123456789 (converted to +60123456789)
 */
export function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Keep only digits and plus, then normalize leading 00 to +
  let cleaned = trimmed.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  // E.164 strict form: "+" + country/national number, total digits 8..15
  // Country code must not start with 0.
  const e164 = /^\+[1-9]\d{7,14}$/;
  if (e164.test(cleaned)) return cleaned;

  // Bare international: digits only, already includes country code (no leading 0)
  if (/^\d{8,15}$/.test(cleaned) && cleaned[0] !== '0') {
    const withPlus = `+${cleaned}`;
    if (e164.test(withPlus)) return withPlus;
  }

  return null;
}

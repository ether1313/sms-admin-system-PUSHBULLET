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
 * Normalize phone number to E.164 format (+61...)
 * Accepts various formats and converts to +61
 */
export function normalizePhone(phone: string): string | null {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Handle different formats
  if (cleaned.startsWith('+61')) {
    // Already in +61 format
    if (cleaned.length === 13) {
      return cleaned;
    }
  } else if (cleaned.startsWith('61') && cleaned.length === 11) {
    // 61xxxxxxxxx format
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // 0xxxxxxxxx format
    return `+61${cleaned.substring(1)}`;
  } else if (!cleaned.startsWith('+') && cleaned.length === 9) {
    // xxxxxxxxx format (no leading 0)
    return `+61${cleaned}`;
  }

  // Invalid format
  return null;
}

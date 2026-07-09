import { emailDb as supabase } from '@/lib/email/email-supabase';
import { parseRecipientEntry } from '@/lib/email/email-addresses';

export interface EmailContact {
  email: string;
  name: string | null;
  use_count: number;
}

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/i;

function addContact(
  map: Map<string, EmailContact>,
  rawEmail: string | null | undefined,
  rawName?: string | null
) {
  const email = rawEmail?.trim();
  if (!email || !EMAIL_PATTERN.test(email)) return;

  const key = email.toLowerCase();
  const name = rawName?.trim() || null;
  const existing = map.get(key);

  if (!existing) {
    map.set(key, { email, name, use_count: 1 });
    return;
  }

  existing.use_count += 1;
  if (!existing.name && name) {
    existing.name = name;
  }
}

export async function listEmailContacts(excludeAddress?: string): Promise<EmailContact[]> {
  const exclude = excludeAddress?.trim().toLowerCase() || null;

  const { data, error } = await supabase
    .from('processed_emails')
    .select('from_address, from_name, to_addresses, cc_addresses')
    .order('received_at', { ascending: false })
    .limit(1500);

  if (error) throw error;

  const map = new Map<string, EmailContact>();

  for (const row of data ?? []) {
    const fromAddress = row.from_address != null ? String(row.from_address) : null;
    const fromName = row.from_name != null ? String(row.from_name) : null;
    if (fromAddress) addContact(map, fromAddress, fromName);

    for (const field of ['to_addresses', 'cc_addresses'] as const) {
      const values = row[field];
      if (!Array.isArray(values)) continue;
      for (const entry of values) {
        const parsed = parseRecipientEntry(String(entry));
        addContact(map, parsed.email, parsed.name);
      }
    }
  }

  return [...map.values()]
    .filter((contact) => contact.email.toLowerCase() !== exclude)
    .sort((left, right) => {
      if (right.use_count !== left.use_count) {
        return right.use_count - left.use_count;
      }
      const leftLabel = (left.name || left.email).toLowerCase();
      const rightLabel = (right.name || right.email).toLowerCase();
      return leftLabel.localeCompare(rightLabel, 'lt');
    });
}

export function filterEmailContacts(
  contacts: EmailContact[],
  query: string,
  limit = 10
): EmailContact[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return contacts.slice(0, limit);
  }

  return contacts
    .filter((contact) => {
      const email = contact.email.toLowerCase();
      const name = contact.name?.toLowerCase() ?? '';
      return email.includes(needle) || name.includes(needle);
    })
    .slice(0, limit);
}

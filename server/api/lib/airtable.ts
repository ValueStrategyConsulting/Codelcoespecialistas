const AIRTABLE_API = 'https://api.airtable.com/v0';

function getToken(): string {
  const token = process.env.AIRTABLE_PAT || process.env.VITE_AIRTABLE_PAT || '';
  if (!token) throw new Error('AIRTABLE_PAT not configured');
  return token;
}

interface AirtableRecord {
  id: string;
  fields: Record<string, any>;
  createdTime: string;
}

interface AirtableResponse {
  records: AirtableRecord[];
  offset?: string;
}

export async function fetchAllRecords(
  baseId: string,
  tableId: string,
  fieldIds?: string[],
): Promise<AirtableRecord[]> {
  const token = getToken();
  const allRecords: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (fieldIds) fieldIds.forEach(id => params.append('fields[]', id));
    if (offset) params.set('offset', offset);
    params.set('pageSize', '100');

    const url = `${AIRTABLE_API}/${baseId}/${tableId}?${params.toString()}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Airtable API error ${resp.status}: ${text}`);
    }

    const data: AirtableResponse = await resp.json();
    allRecords.push(...data.records);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

// Helper to extract value from singleSelect field
export function selectName(field: any): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field.name || '';
}

// Helper to check if attachments exist
export function hasAttachments(field: any): boolean {
  return Array.isArray(field) && field.length > 0;
}

// Helper to count attachments
export function attachmentCount(field: any): number {
  return Array.isArray(field) ? field.length : 0;
}

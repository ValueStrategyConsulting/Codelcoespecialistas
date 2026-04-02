// Frontend client for API proxy endpoints
// In dev mode, Vite proxy routes /api/* to the local dev server plugin
// In production, these would be serverless functions

const API_BASE = '/api';

async function fetchJSON<T>(endpoint: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${endpoint}`);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

export const airtableClient = {
  async getProcesos() {
    return fetchJSON<any[]>('/procesos');
  },

  async getEncuestas() {
    return fetchJSON<any[]>('/encuestas');
  },

  async getOnePage() {
    return fetchJSON<any[]>('/onepage');
  },
};

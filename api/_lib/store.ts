const API_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const API_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function configured(): boolean {
  return Boolean(API_URL && API_TOKEN);
}

async function redis<T>(command: unknown[]): Promise<T> {
  if (!configured()) throw new Error('Missing KV_REST_API_URL/KV_REST_API_TOKEN or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN');
  const response = await fetch(`${API_URL}/pipeline`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${API_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify([command]),
  });
  if (!response.ok) throw new Error(`Redis returned ${response.status}`);
  const [result] = await response.json();
  if (result.error) throw new Error(result.error);
  return result.result as T;
}

export const store = {
  configured,
  async seen(id: string): Promise<boolean> {
    const result = await redis<number>(['SISMEMBER', 'madrid-radar:seen', id]);
    return result === 1;
  },
  async markSeen(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await redis<number>(['SADD', 'madrid-radar:seen', ...ids]);
  },
  async initialized(): Promise<boolean> {
    const result = await redis<string | null>(['GET', 'madrid-radar:initialized']);
    return result === '1';
  },
  async setInitialized(): Promise<void> {
    await redis<string>(['SET', 'madrid-radar:initialized', '1']);
  },
};

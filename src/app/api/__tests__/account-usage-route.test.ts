// ABOUTME: Vitest tests for the GET /api/account/usage endpoint.
// ABOUTME: Verifies month-filtered event retrieval, lifetime total, tier limit, and auth enforcement.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/auth', () => ({
  getUserFromRequest: vi.fn(async () => ({
    id: 'user-1', email: 'test@northwestern.edu', first_name: 'Test', last_name: null, tier: 'free',
  })),
}));

// Fluent builder stub: every method returns a new builder that eventually resolves to `result`.
// The final awaited value is `result` — any chain of method calls leads to the same resolved value.
function makeBuilder(result: unknown) {
  const builder: Record<string, unknown> = {};
  const methods = ['select', 'eq', 'gte', 'lt', 'order', 'single'];
  for (const m of methods) {
    builder[m] = () => makeBuilder(result);
  }
  // Make the builder itself a thenable so `await builder` resolves to result.
  builder['then'] = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
vi.mock('@/lib/db', () => ({ supabase: { from: mockFrom } }));

const defaultEventsData = {
  data: [{ id: 'e1', created_at: '2026-04-10T12:00:00Z', service: 'chat', model: 'claude-sonnet-4-20250514', input_tokens: 100, output_tokens: 50, input_cost_usd: 0.0003, output_cost_usd: 0.00075 }],
  error: null,
};

describe('GET /api/account/usage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_credits') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { total_cost_usd: 1.5 }, error: null }) }) }) };
      }
      if (table === 'admin_config') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { value: { free: 5.0, pro: null } }, error: null }) }) }) };
      }
      if (table === 'llm_usage_events') {
        return makeBuilder(Promise.resolve(defaultEventsData));
      }
    });
  });

  it('returns total_cost_usd, tier, tier_limit_usd, and monthly events', async () => {
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=2026-04'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total_cost_usd).toBe(1.5);
    expect(body.tier).toBe('free');
    expect(body.tier_limit_usd).toBe(5.0);
    expect(body.events).toHaveLength(1);
  });

  it('returns 400 for invalid month format', async () => {
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=not-a-month'));
    expect(response.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    const { getUserFromRequest } = await import('@/lib/auth');
    vi.mocked(getUserFromRequest).mockResolvedValueOnce(null);
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=2026-04'));
    expect(response.status).toBe(401);
  });

  it('defaults to current month when ?month param is omitted', async () => {
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events).toBeDefined();
    expect(Array.isArray(body.events)).toBe(true);
  });

  it('returns tier_limit_usd as null for pro tier users', async () => {
    const { getUserFromRequest } = await import('@/lib/auth');
    vi.mocked(getUserFromRequest).mockResolvedValueOnce({
      id: 'user-2', email: 'pro@northwestern.edu', first_name: 'Pro', last_name: null, tier: 'pro',
    });
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=2026-04'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.tier).toBe('pro');
    expect(body.tier_limit_usd).toBeNull();
  });

  it('returns event objects with all required fields', async () => {
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=2026-04'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.events).toHaveLength(1);
    const event = body.events[0];
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('created_at');
    expect(event).toHaveProperty('service');
    expect(event).toHaveProperty('model');
    expect(event).toHaveProperty('input_tokens');
    expect(event).toHaveProperty('output_tokens');
    expect(event).toHaveProperty('input_cost_usd');
    expect(event).toHaveProperty('output_cost_usd');
  });

  it('returns 500 when llm_usage_events query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_credits') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { total_cost_usd: 1.5 }, error: null }) }) }) };
      }
      if (table === 'admin_config') {
        return { select: () => ({ eq: () => ({ single: async () => ({ data: { value: { free: 5.0, pro: null } }, error: null }) }) }) };
      }
      if (table === 'llm_usage_events') {
        return makeBuilder(Promise.resolve({ data: null, error: { message: 'DB connection lost', code: '08006' } }));
      }
    });
    const { GET } = await import('@/app/api/account/usage/route');
    const response = await GET(new NextRequest('http://localhost/api/account/usage?month=2026-04'));
    expect(response.status).toBe(500);
  });
});

// ABOUTME: Unit tests for the password-resets repository.
// ABOUTME: Verifies token creation, validation, and mark-used behavior with mocked Supabase.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockGt = vi.fn();
const mockSingle = vi.fn();

vi.mock('@/lib/db', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/db';

function makeChain(finalValue: unknown) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.gt = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve(finalValue));
  return chain;
}

describe('password-resets repository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('createPasswordReset', () => {
    it('returns a 64-character hex token', async () => {
      const chain = makeChain({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { createPasswordReset } = await import('@/lib/repositories/password-resets');
      const token = await createPasswordReset('user-1');
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]+$/);
    });

    it('does not store the raw token (stores a hash instead)', async () => {
      let storedData: Record<string, unknown> | null = null;
      const chain = makeChain({ data: null, error: null });
      (chain.insert as ReturnType<typeof vi.fn>).mockImplementation((data: Record<string, unknown>) => {
        storedData = data;
        return chain;
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { createPasswordReset } = await import('@/lib/repositories/password-resets');
      const token = await createPasswordReset('user-1');

      expect(storedData).not.toBeNull();
      expect((storedData as Record<string, unknown>).token_hash).not.toBe(token);
      expect((storedData as Record<string, unknown>).token_hash).toHaveLength(64);
    });
  });

  describe('validateResetToken', () => {
    it('returns null when token is not found', async () => {
      const chain = makeChain({ data: null, error: { code: 'PGRST116' } });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { validateResetToken } = await import('@/lib/repositories/password-resets');
      const result = await validateResetToken('nonexistent-token');
      expect(result).toBeNull();
    });

    it('returns id and userId when token is valid', async () => {
      const chain = makeChain({
        data: { id: 'reset-1', user_id: 'user-1' },
        error: null,
      });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { validateResetToken } = await import('@/lib/repositories/password-resets');
      const result = await validateResetToken('a'.repeat(64));
      expect(result).toEqual({ id: 'reset-1', userId: 'user-1' });
    });
  });

  describe('markTokenUsed', () => {
    it('calls update with used_at set', async () => {
      const chain = makeChain({ data: null, error: null });
      vi.mocked(supabase.from).mockReturnValue(chain as never);

      const { markTokenUsed } = await import('@/lib/repositories/password-resets');
      await markTokenUsed('reset-1');
      expect(chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ used_at: expect.any(String) })
      );
    });
  });
});

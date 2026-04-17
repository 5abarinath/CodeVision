// ABOUTME: Tests for the updateUserPassword function in the users repository.
// ABOUTME: Verifies bcrypt hashing and Supabase update are called correctly.
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(async () => 'hashed-password'),
    compare: vi.fn(async () => true),
  },
}));

const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/db', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: mockUpdate,
    })),
  },
}));

import { supabase } from '@/lib/db';

describe('updateUserPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const chain = { update: mockUpdate, eq: mockEq };
    mockUpdate.mockReturnValue(chain);
    mockEq.mockResolvedValue({ error: null });
    vi.mocked(supabase.from).mockReturnValue(chain as never);
  });

  it('hashes the password before storing', async () => {
    const bcrypt = await import('bcryptjs');
    const { updateUserPassword } = await import('@/lib/repositories/users');
    await updateUserPassword('user-1', 'newpassword123');
    expect(bcrypt.default.hash).toHaveBeenCalledWith('newpassword123', 10);
  });

  it('calls supabase update with the hashed password', async () => {
    const { updateUserPassword } = await import('@/lib/repositories/users');
    await updateUserPassword('user-1', 'newpassword123');
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ password_hash: 'hashed-password' })
    );
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('throws when supabase update fails', async () => {
    const chain = { update: mockUpdate, eq: mockEq };
    mockUpdate.mockReturnValue(chain);
    mockEq.mockResolvedValue({ error: { message: 'db error' } });
    vi.mocked(supabase.from).mockReturnValue(chain as never);

    const { updateUserPassword } = await import('@/lib/repositories/users');
    await expect(updateUserPassword('user-1', 'newpassword123')).rejects.toThrow('Failed to update password');
  });
});

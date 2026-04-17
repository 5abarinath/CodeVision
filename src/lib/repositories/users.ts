// ABOUTME: Repository functions for creating and querying users in the Supabase users table.
// ABOUTME: Handles password hashing and exposes typed wrappers around raw Supabase queries.
import { supabase } from '../db';
import type { User } from '../db';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  email: string;
  password: string;
  first_name: string;
  last_name?: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const password_hash = await bcrypt.hash(input.password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: input.email.toLowerCase(),
      password_hash,
      first_name: input.first_name,
      last_name: input.last_name ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) return null;
  return data as User;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
  const password_hash = await bcrypt.hash(newPassword, 10);

  const { error } = await supabase
    .from('users')
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (error) {
    throw new Error('Failed to update password');
  }
}

import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AccountSummary {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string;
}

interface ProfileOverride {
  fullName?: string;
  avatarUrl?: string;
}

const PROFILE_OVERRIDE_PREFIX = 'ml_profile_override:';
export const PROFILE_UPDATED_EVENT = 'ml:profile-updated';

export const mapSupabaseUser = (user: SupabaseUser | null): AccountSummary | null => {
  if (!user) return null;

  const metadata = (user.user_metadata || {}) as Record<string, unknown>;
  const fullName = String(metadata.full_name || metadata.name || user.email || 'Google User');
  const avatarUrl = String(metadata.avatar_url || '');

  return {
    id: user.id,
    email: user.email || '-',
    fullName,
    avatarUrl,
  };
};

const getStorageKey = (userId: string) => `${PROFILE_OVERRIDE_PREFIX}${userId}`;

export const getProfileOverride = (userId: string): ProfileOverride | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileOverride;
    return {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : undefined,
      avatarUrl: typeof parsed.avatarUrl === 'string' ? parsed.avatarUrl : undefined,
    };
  } catch {
    return null;
  }
};

export const saveProfileOverride = (userId: string, override: ProfileOverride) => {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(override));
  window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
};

export const mergeProfileWithOverride = (account: AccountSummary | null): AccountSummary | null => {
  if (!account) return null;

  const override = getProfileOverride(account.id);
  if (!override) return account;

  return {
    ...account,
    fullName: override.fullName?.trim() || account.fullName,
    avatarUrl: override.avatarUrl?.trim() || account.avatarUrl,
  };
};


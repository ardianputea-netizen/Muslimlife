import type { ThemePreference } from './profileSettings';

export const THEME_STORAGE_KEY = 'ml:theme:v1';
const READER_SETTINGS_KEY = 'ml:readerSettings:v1';
const LEGACY_THEME_STORAGE_KEYS = ['theme', 'app-theme', 'theme-preference', 'ml_theme', 'ml_theme_preference'];

const normalizeTheme = (value: unknown): ThemePreference => {
  if (value === 'dark' || value === 'system' || value === 'light') return value;
  return 'system';
};

const migrateLegacyThemeStorage = () => {
  if (typeof window === 'undefined') return;
  for (const key of LEGACY_THEME_STORAGE_KEYS) {
    const value = String(window.localStorage.getItem(key) || '').toLowerCase().trim();
    if (!value) continue;
    const normalized = normalizeTheme(value);
    if (!window.localStorage.getItem(THEME_STORAGE_KEY)) {
      window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
    }
    window.localStorage.removeItem(key);
  }
};

const readReaderTheme = (): ThemePreference => {
  if (typeof window === 'undefined') return 'light';
  try {
    const raw = window.localStorage.getItem(READER_SETTINGS_KEY);
    if (!raw) return 'system';
    const parsed = JSON.parse(raw);
    return normalizeTheme(parsed?.theme);
  } catch {
    return 'system';
  }
};

export const readStoredThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') return 'system';
  migrateLegacyThemeStorage();
  const rawDirect = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (rawDirect) return normalizeTheme(rawDirect);
  return readReaderTheme();
};

export const resolveThemePreference = (theme: ThemePreference) => {
  if (theme === 'dark') return 'dark';
  if (theme === 'light') return 'light';
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

const applyRootTheme = (preferred: ThemePreference) => {
  if (typeof document === 'undefined') return;
  const desired = resolveThemePreference(preferred);
  const root = document.documentElement;
  root.setAttribute('data-theme', desired);
  root.setAttribute('data-theme-mode', preferred);
  root.classList.toggle('dark', desired === 'dark');
  root.style.colorScheme = desired;
  return desired;
};

export const applyThemePreference = (theme: ThemePreference, options?: { persist?: boolean }) => {
  const persist = options?.persist !== false;
  if (typeof window !== 'undefined' && persist) {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
  return applyRootTheme(theme);
};

export const initializeThemePreference = () => {
  const preferred = readStoredThemePreference();
  return applyThemePreference(preferred, { persist: false }) || 'light';
};

export const getThemeLabel = (theme: ThemePreference) => {
  const current = normalizeTheme(theme);
  if (current === 'dark') return 'Gelap';
  if (current === 'system') return 'Sistem';
  return 'Terang';
};

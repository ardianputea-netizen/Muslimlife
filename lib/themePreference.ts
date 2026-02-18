import type { ThemePreference } from './profileSettings';

const THEME_STORAGE_KEYS = ['theme', 'app-theme', 'theme-preference', 'ml_theme', 'ml_theme_preference'];

const migrateThemeStorageToLight = () => {
  if (typeof window === 'undefined') return;
  for (const key of THEME_STORAGE_KEYS) {
    const value = String(window.localStorage.getItem(key) || '').toLowerCase();
    if (value === 'dark' || value === 'system') {
      window.localStorage.setItem(key, 'light');
    }
  }
};

export const applyThemePreference = (_theme: ThemePreference) => {
  if (typeof document === 'undefined') return;

  migrateThemeStorageToLight();
  const root = document.documentElement;
  root.classList.remove('dark');

  root.style.colorScheme = 'light';
};

export const getThemeLabel = (_theme: ThemePreference) => {
  return 'Terang';
};

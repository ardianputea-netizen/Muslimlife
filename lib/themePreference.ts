import type { ThemePreference } from './profileSettings';

const resolveTheme = (theme: ThemePreference): 'light' | 'dark' => {
  if (theme === 'light' || theme === 'dark') return theme;
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyThemePreference = (theme: ThemePreference) => {
  if (typeof document === 'undefined') return;

  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');

  root.style.colorScheme = resolved;
};

export const getThemeLabel = (theme: ThemePreference) => {
  if (theme === 'light') return 'Terang';
  if (theme === 'dark') return 'Gelap';
  return 'Sistem';
};

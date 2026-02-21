import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { applyThemePreference, readStoredThemePreference, resolveThemePreference } from '@/lib/themePreference';

export type ReaderTheme = 'light' | 'dark' | 'system';

export interface ReaderSettings {
  arabFontScale: number;
  showLatin: boolean;
  showTranslation: boolean;
  theme: ReaderTheme;
}

interface ReaderSettingsContextValue {
  settings: ReaderSettings;
  resolvedTheme: 'light' | 'dark';
  setArabFontScale: (value: number) => void;
  setShowLatin: (value: boolean) => void;
  setShowTranslation: (value: boolean) => void;
  setTheme: (value: ReaderTheme) => void;
}

const STORAGE_KEY = 'ml:readerSettings:v1';

const DEFAULT_SETTINGS: ReaderSettings = {
  arabFontScale: 1,
  showLatin: true,
  showTranslation: true,
  theme: 'system',
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalize = (raw: any): ReaderSettings => ({
  arabFontScale: clamp(Number(raw?.arabFontScale || DEFAULT_SETTINGS.arabFontScale), 0.85, 1.4),
  showLatin: typeof raw?.showLatin === 'boolean' ? raw.showLatin : DEFAULT_SETTINGS.showLatin,
  showTranslation: typeof raw?.showTranslation === 'boolean' ? raw.showTranslation : DEFAULT_SETTINGS.showTranslation,
  theme: raw?.theme === 'light' || raw?.theme === 'dark' || raw?.theme === 'system' ? raw.theme : DEFAULT_SETTINGS.theme,
});

const readStored = (): ReaderSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const normalized = normalize(JSON.parse(raw));
    return {
      ...normalized,
      theme: readStoredThemePreference(),
    };
  } catch {
    return {
      ...DEFAULT_SETTINGS,
      theme: readStoredThemePreference(),
    };
  }
};

const writeStored = (value: ReaderSettings) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

const ReaderSettingsContext = createContext<ReaderSettingsContextValue | null>(null);

export const ReaderSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<ReaderSettings>(() => readStored());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveThemePreference(readStored().theme)
  );

  useEffect(() => {
    writeStored(settings);
  }, [settings]);

  useEffect(() => {
    const syncTheme = () => {
      const nextResolved = applyThemePreference(settings.theme) || resolveThemePreference(settings.theme);
      setResolvedTheme(nextResolved);
      const root = document.documentElement;
      root.style.setProperty('--ml-arab-font-scale', String(settings.arabFontScale));
    };

    syncTheme();
    if (settings.theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => syncTheme();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [settings.arabFontScale, settings.theme]);

  const value = useMemo<ReaderSettingsContextValue>(
    () => ({
      settings,
      resolvedTheme,
      setArabFontScale: (value) => setSettings((prev) => ({ ...prev, arabFontScale: clamp(value, 0.85, 1.4) })),
      setShowLatin: (value) => setSettings((prev) => ({ ...prev, showLatin: value })),
      setShowTranslation: (value) => setSettings((prev) => ({ ...prev, showTranslation: value })),
      setTheme: (value) => setSettings((prev) => ({ ...prev, theme: value })),
    }),
    [resolvedTheme, settings]
  );

  return <ReaderSettingsContext.Provider value={value}>{children}</ReaderSettingsContext.Provider>;
};

export const useReaderSettings = () => {
  const context = useContext(ReaderSettingsContext);
  if (!context) throw new Error('useReaderSettings must be used inside ReaderSettingsProvider');
  return context;
};

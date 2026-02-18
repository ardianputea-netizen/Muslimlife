import type { CalculationMethodId } from './prayerTimes';

export type ThemePreference = 'light';
export type PrayerCalcMethod = 'KEMENAG' | 'MUIS' | 'MWL' | 'UMM_AL_QURA';

export interface NotificationSettingsPreference {
  enabled: boolean;
  adzan: boolean;
  notes: boolean;
  ramadhan: boolean;
}

export interface ProfileSettingsRecord {
  theme: ThemePreference;
  notification_settings: NotificationSettingsPreference;
  prayer_calc_method: PrayerCalcMethod;
  compass_calibrated_at: string | null;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettingsPreference = {
  enabled: true,
  adzan: true,
  notes: true,
  ramadhan: true,
};

export const DEFAULT_PROFILE_SETTINGS: ProfileSettingsRecord = {
  theme: 'light',
  notification_settings: DEFAULT_NOTIFICATION_SETTINGS,
  prayer_calc_method: 'KEMENAG',
  compass_calibrated_at: null,
};

const PROFILE_METHOD_STORAGE_KEY = 'ml_profile_prayer_calc_method';

export const PRAYER_METHOD_OPTIONS: Array<{
  value: PrayerCalcMethod;
  label: string;
  subtitle: string;
}> = [
  {
    value: 'KEMENAG',
    label: 'Kemenag RI (Indonesia)',
    subtitle: 'Rekomendasi default untuk Indonesia',
  },
  {
    value: 'MUIS',
    label: 'Majlis Ugama Islam Singapura (MUIS)',
    subtitle: 'Parameter Singapura / MUIS',
  },
  {
    value: 'MWL',
    label: 'Muslim World League (MWL)',
    subtitle: 'Metode global Muslim World League',
  },
  {
    value: 'UMM_AL_QURA',
    label: 'Umm al-Qura Univ, Makkah',
    subtitle: 'Metode resmi Umm al-Qura',
  },
];

const normalizeTheme = (value: unknown): ThemePreference => {
  if (value === 'light') return 'light';
  return 'light';
};

const normalizePrayerMethod = (value: unknown): PrayerCalcMethod => {
  if (value === 'KEMENAG' || value === 'MUIS' || value === 'MWL' || value === 'UMM_AL_QURA') {
    return value;
  }
  return 'KEMENAG';
};

export const normalizeNotificationSettings = (value: unknown): NotificationSettingsPreference => {
  const raw = (value || {}) as Partial<NotificationSettingsPreference>;
  return {
    enabled: raw.enabled ?? DEFAULT_NOTIFICATION_SETTINGS.enabled,
    adzan: raw.adzan ?? DEFAULT_NOTIFICATION_SETTINGS.adzan,
    notes: raw.notes ?? DEFAULT_NOTIFICATION_SETTINGS.notes,
    ramadhan: raw.ramadhan ?? DEFAULT_NOTIFICATION_SETTINGS.ramadhan,
  };
};

export const normalizeProfileSettings = (value: Partial<ProfileSettingsRecord> | null | undefined): ProfileSettingsRecord => {
  return {
    theme: normalizeTheme(value?.theme),
    notification_settings: normalizeNotificationSettings(value?.notification_settings),
    prayer_calc_method: normalizePrayerMethod(value?.prayer_calc_method),
    compass_calibrated_at:
      typeof value?.compass_calibrated_at === 'string' ? value.compass_calibrated_at : null,
  };
};

export const getPrayerCalcConfig = (method: PrayerCalcMethod): CalculationMethodId => {
  switch (method) {
    case 'MUIS':
      return 'singapore';
    case 'MWL':
      return 'muslim_world_league';
    case 'UMM_AL_QURA':
      return 'umm_al_qura';
    case 'KEMENAG':
    default:
      return 'kemenag';
  }
};

export const getPrayerCalcLabel = (method: PrayerCalcMethod) => {
  const option = PRAYER_METHOD_OPTIONS.find((item) => item.value === method);
  return option?.label || PRAYER_METHOD_OPTIONS[0].label;
};

export const cacheProfilePrayerMethod = (method: PrayerCalcMethod) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROFILE_METHOD_STORAGE_KEY, method);
};

export const getCachedProfilePrayerMethod = (): PrayerCalcMethod | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PROFILE_METHOD_STORAGE_KEY);
  if (!raw) return null;
  return normalizePrayerMethod(raw);
};

export const clearCachedProfilePrayerMethod = () => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PROFILE_METHOD_STORAGE_KEY);
};

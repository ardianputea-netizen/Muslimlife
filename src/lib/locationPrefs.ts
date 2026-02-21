export type LocationPrefs = {
  lat: number;
  lng: number;
  label?: string;
  source: 'device' | 'default';
  updatedAt: number;
};

const STORAGE_KEY = 'ml:location:v1';
export const LOCATION_CHANGED_EVENT = 'ml:location-changed';

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isLocationPrefs = (value: unknown): value is LocationPrefs => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<LocationPrefs>;
  return (
    isFiniteNumber(row.lat) &&
    isFiniteNumber(row.lng) &&
    (row.source === 'device' || row.source === 'default') &&
    isFiniteNumber(row.updatedAt)
  );
};

const emitLocationChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(LOCATION_CHANGED_EVENT));
};

export const getSavedLocation = (): LocationPrefs | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!isLocationPrefs(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const saveLocation = (loc: LocationPrefs): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
  emitLocationChanged();
};

export const clearLocation = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  emitLocationChanged();
};

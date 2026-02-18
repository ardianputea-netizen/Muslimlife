export type LocationPermissionState = 'pending' | 'granted' | 'denied' | 'unsupported';

export interface SavedLocation {
  lat: number;
  lng: number;
  updated_at: string;
}

const STORAGE_KEY = 'ml_saved_location';

export const getSavedLocation = (): SavedLocation | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedLocation;
    if (typeof parsed.lat !== 'number' || typeof parsed.lng !== 'number' || !parsed.updated_at) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const getLocationPermissionStatus = async (): Promise<LocationPermissionState> => {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) return 'unsupported';

  const saved = getSavedLocation();
  if (!('permissions' in navigator)) return saved ? 'granted' : 'pending';

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' });
    if (result.state === 'granted') return 'granted';
    if (result.state === 'denied') return 'denied';
    return saved ? 'granted' : 'pending';
  } catch {
    return saved ? 'granted' : 'pending';
  }
};

export const getLocation = async (): Promise<SavedLocation> => {
  if (typeof window === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('Geolocation tidak tersedia');
  }

  const position = await new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 9000,
    });
  });

  const data: SavedLocation = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    updated_at: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  return data;
};

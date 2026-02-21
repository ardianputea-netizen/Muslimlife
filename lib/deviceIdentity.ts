const DEVICE_ID_KEY = 'ml:deviceId:v1';
const RATED_FLAG_KEY = 'ml:rated:v1';
const RATED_DEVICE_KEY = 'ml:ratedDevice:v1';
const DEVICE_COOKIE_KEY = 'ml_device_id';

let memoryDeviceId = '';
let memoryRatedFlag = false;

const isBrowser = () => typeof window !== 'undefined';

const safeReadStorage = (key: string) => {
  if (!isBrowser()) return '';
  try {
    return String(window.localStorage.getItem(key) || '').trim();
  } catch {
    return '';
  }
};

const safeWriteStorage = (key: string, value: string) => {
  if (!isBrowser()) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const readCookie = (key: string) => {
  if (!isBrowser()) return '';
  const cookies = String(document.cookie || '').split(';');
  for (const raw of cookies) {
    const [name, ...parts] = raw.trim().split('=');
    if (name === key) return decodeURIComponent(parts.join('=') || '');
  }
  return '';
};

const writeCookie = (key: string, value: string, maxAgeSec: number) => {
  if (!isBrowser()) return;
  document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSec}; SameSite=Lax`;
};

const createUuidV4Fallback = () => {
  const bytes = new Uint8Array(16);
  const random = () => Math.floor(Math.random() * 256);
  for (let i = 0; i < bytes.length; i += 1) bytes[i] = random();
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};

const createDeviceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return createUuidV4Fallback();
};

export const getOrCreateDeviceId = () => {
  if (!isBrowser()) return 'server-device-id';

  const fromStorage = safeReadStorage(DEVICE_ID_KEY);
  if (fromStorage) return fromStorage;

  const fromCookie = readCookie(DEVICE_COOKIE_KEY).trim();
  if (fromCookie) {
    memoryDeviceId = fromCookie;
    safeWriteStorage(DEVICE_ID_KEY, fromCookie);
    return fromCookie;
  }

  if (memoryDeviceId) return memoryDeviceId;

  const next = createDeviceId();
  memoryDeviceId = next;
  const persisted = safeWriteStorage(DEVICE_ID_KEY, next);
  if (!persisted) {
    // Keep stable per session even when localStorage blocked.
    writeCookie(DEVICE_COOKIE_KEY, next, 60 * 60 * 12);
  }

  if (import.meta.env.DEV) {
    console.info('[rating] deviceId ready', { hasStorage: persisted, hasCookie: !persisted, length: next.length });
  }
  return next;
};

export const hasRatedFlag = () => {
  if (!isBrowser()) return false;
  const value = safeReadStorage(RATED_FLAG_KEY);
  if (value) return value === '1';
  return memoryRatedFlag;
};

export const setRatedFlag = (rated: boolean) => {
  if (!isBrowser()) return;
  memoryRatedFlag = rated;
  if (rated) {
    safeWriteStorage(RATED_FLAG_KEY, '1');
    safeWriteStorage(RATED_DEVICE_KEY, getOrCreateDeviceId());
    return;
  }
  safeWriteStorage(RATED_FLAG_KEY, '0');
};

export const isRatedForCurrentDevice = () => {
  if (!isBrowser()) return false;
  if (!hasRatedFlag()) return false;
  const savedDevice = safeReadStorage(RATED_DEVICE_KEY);
  if (!savedDevice) return true;
  return savedDevice === getOrCreateDeviceId();
};


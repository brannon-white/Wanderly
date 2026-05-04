import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PREFIX = 'wc:';
const memory = new Map<string, { value: unknown; expires: number }>();

export async function cacheGet<T>(key: string): Promise<T | null> {
  const mem = memory.get(key);
  if (mem) {
    if (Date.now() < mem.expires) return mem.value as T;
    memory.delete(key);
  }

  try {
    const raw = await AsyncStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const { value, expires } = JSON.parse(raw);
    if (Date.now() > expires) {
      AsyncStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
    memory.set(key, { value, expires });
    return value as T;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlDays: number): Promise<void> {
  const expires = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  memory.set(key, { value, expires });
  try {
    await AsyncStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ value, expires }));
  } catch {
    // AsyncStorage failure is non-fatal — memory cache still works for the session
  }
}

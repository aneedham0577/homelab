import { tryApiCall } from './api';
import type { UserSettings } from '../types/api';

let cachedExcludedWords: Record<string, string[]> | null = null;
let loadPromise: Promise<Record<string, string[]>> | null = null;

export async function getGameExcludedWords(gameKey: string): Promise<string[]> {
    if (cachedExcludedWords) {
        return cachedExcludedWords[gameKey] || [];
    }
    if (!loadPromise) {
        loadPromise = tryApiCall<{ settings: UserSettings }>('/user-settings')
            .then((res) => {
                const map = res.data?.settings?.wordGameExcludedWords;
                cachedExcludedWords = (map && typeof map === 'object') ? map : {};
                return cachedExcludedWords;
            })
            .catch(() => {
                cachedExcludedWords = cachedExcludedWords || {};
                return cachedExcludedWords;
            })
            .finally(() => {
                loadPromise = null;
            });
    }
    const all = await loadPromise;
    return all[gameKey] || [];
}

export function peekGameExcludedWords(gameKey: string): string[] {
    return cachedExcludedWords?.[gameKey] || [];
}

export async function saveGameExcludedWords(gameKey: string, words: string[]): Promise<void> {
    const clean = Array.from(
        new Set(
            words
                .map((w) => w.trim().toLowerCase())
                .filter((w) => /^[a-z]+$/.test(w))
        )
    );

    const currentMap = cachedExcludedWords ? { ...cachedExcludedWords } : {};
    currentMap[gameKey] = clean;
    cachedExcludedWords = currentMap;

    try {
        await tryApiCall('/user-settings', {
            method: 'PUT',
            data: {
                wordGameExcludedWords: currentMap
            }
        });
    } catch (err) {
        console.error('Failed to save excluded words to user settings', err);
    }
}

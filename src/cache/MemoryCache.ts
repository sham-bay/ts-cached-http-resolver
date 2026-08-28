import type { CacheStore } from './CacheStore';
import type { CacheItem } from '../types';

/**
 * In‑memory cache store using a JavaScript `Map`.
 * Suitable for single‑process applications.
 */
export class MemoryCache implements CacheStore {
	private storage = new Map<string, CacheItem<unknown>>();

	/** @inheritdoc */
	async get<T>(key: string): Promise<CacheItem<T> | undefined> {
		return this.storage.get(key) as CacheItem<T> | undefined;
	}

	/** @inheritdoc */
	async set<T>(key: string, item: CacheItem<T>): Promise<void> {
		this.storage.set(key, item);
	}

	/** @inheritdoc */
	async delete(key: string): Promise<void> {
		this.storage.delete(key);
	}

	/** @inheritdoc */
	async clear(): Promise<void> {
		this.storage.clear();
	}

	/** @inheritdoc */
	async entries(): Promise<Array<[string, CacheItem<unknown>]>> {
		return Array.from(this.storage.entries());
	}
}

import type { CacheItem } from '../types/CacheItem.js';

/**
 * Generic interface for a cache storage backend.
 * All methods are asynchronous to support both in‑memory and external stores.
 */
export interface CacheStore {
	/**
	 * Retrieves a cached item by key.
	 * Returns `undefined` if the key does not exist.
	 * The caller is responsible for checking expiry.
	 */
	get<T>(key: string): Promise<CacheItem<T> | undefined>;

	/**
	 * Stores an item under the given key.
	 */
	set<T>(key: string, item: CacheItem<T>): Promise<void>;

	/**
	 * Deletes an item by key.
	 */
	delete(key: string): Promise<void>;

	/**
	 * Removes all items from the cache.
	 */
	clear(): Promise<void>;

	/**
	 * Optional: returns all entries for debugging purposes.
	 * Not all stores may support this.
	 */
	entries?(): Promise<Array<[string, CacheItem<unknown>]>>;
}

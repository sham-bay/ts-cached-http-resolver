/**
 * An item stored in the cache.
 */
export interface CacheItem<T> {
	/** The cached value. */
	value: T;

	/**
	 * Expiration timestamp in milliseconds since epoch, or `null` for never‑expiring.
	 */
	expiry: number | null;
}

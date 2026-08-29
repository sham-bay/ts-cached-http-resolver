import { MemoryCache } from '../cache/MemoryCache.js';
import { RedisCache, type RedisCacheOptions } from '../cache/RedisCache.js';
import type { CacheStore } from '../cache/CacheStore.js';

/**
 * Supported cache store types.
 */
export type CacheStoreType = 'memory' | 'redis';

/**
 * Factory function to create a cache store instance.
 *
 * @param type - The desired cache store type.
 * @param options - Required for `'redis'`, ignored for `'memory'`.
 * @returns A CacheStore instance.
 * @throws {Error} If type is unsupported or Redis options are missing.
 */
export function createCacheStore(type: CacheStoreType, options?: RedisCacheOptions): CacheStore {
	switch (type) {
		case 'memory':
			return new MemoryCache();
		case 'redis':
			if (!options) {
				throw new Error('RedisCache requires options (redis instance or connection config)');
			}
			return new RedisCache(options);
		default:
			throw new Error(`Unsupported cache store type: ${type}`);
	}
}

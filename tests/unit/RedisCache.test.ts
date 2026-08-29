import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RedisCache } from '../../src/cache/RedisCache.js';
import type { CacheItem } from '../../src/types/CacheItem.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentMock: any;

vi.mock('ioredis', () => ({
	default: class MockRedis {
		constructor() {
			return currentMock;
		}
	}
}));

/**
 * Create a mock Redis instance that inherits from Redis.prototype
 * so that `instanceof Redis` returns true.
 */
function createcurrentMock() {
	const store = new Map<string, string>();

	return {
		get: vi.fn(async (key: string) => store.get(key) || null),
		set: vi.fn(async (key: string, value: string) => {
			store.set(key, value);
			return 'OK';
		}),
		del: vi.fn(async (...keys: string[]) => {
			keys.forEach((k) => store.delete(k));
			return keys.length;
		}),
		keys: vi.fn(async (pattern: string) => {
			if (pattern === '*') {
				return Array.from(store.keys());
			}
			const prefix = pattern.replace('*', '');
			return Array.from(store.keys()).filter((k) => k.startsWith(prefix));
		}),
		ttl: vi.fn(async () => -1),
		ping: vi.fn(async () => 'PONG'),
		quit: vi.fn(async () => {})
	};
}

describe('RedisCache', () => {
	let cache: RedisCache;

	beforeEach(() => {
		const mock = createcurrentMock();
		currentMock = mock;
		cache = new RedisCache({
			redis: { host: 'localhost', port: 6379 },
			keyPrefix: 'test:'
		});
	});

	describe('get', () => {
		it('should retrieve a stored item', async () => {
			const item: CacheItem<number> = { value: 42, expiry: null };
			const serialized = JSON.stringify(item);
			await currentMock.set('test:key', serialized);

			const result = await cache.get<number>('key');
			expect(result).toEqual(item);
			expect(currentMock.get).toHaveBeenCalledWith('test:key');
		});

		it('should return undefined if key does not exist', async () => {
			const result = await cache.get('missing');
			expect(result).toBeUndefined();
			expect(currentMock.get).toHaveBeenCalledWith('test:missing');
		});

		it('should return undefined if stored JSON is invalid', async () => {
			await currentMock.set('test:invalid', '{ not json');
			const result = await cache.get('invalid');
			expect(result).toBeUndefined();
		});
	});

	describe('set', () => {
		it('should store an item without TTL (expiry null)', async () => {
			const item: CacheItem<string> = { value: 'hello', expiry: null };
			await cache.set('key', item);

			expect(currentMock.set).toHaveBeenCalledWith('test:key', JSON.stringify(item));
		});

		it('should store an item with TTL when expiry is set', async () => {
			const expiry = Date.now() + 5000;
			const item: CacheItem<string> = { value: 'hello', expiry };
			await cache.set('key', item);

			const ttlSeconds = Math.max(1, Math.floor((expiry - Date.now()) / 1000));
			expect(currentMock.set).toHaveBeenCalledWith(
				'test:key',
				JSON.stringify(item),
				'EX',
				ttlSeconds
			);
		});

		it('should handle expiry in the past gracefully (TTL at least 1s)', async () => {
			const expiry = Date.now() - 1000;
			const item: CacheItem<string> = { value: 'hello', expiry };
			await cache.set('key', item);

			expect(currentMock.set).toHaveBeenCalledWith(
				'test:key',
				JSON.stringify(item),
				'EX',
				expect.any(Number)
			);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const ttl = (currentMock.set.mock.calls[0] as any)[3];
			expect(ttl).toBeGreaterThanOrEqual(1);
		});
	});

	describe('delete', () => {
		it('should delete a key', async () => {
			await cache.delete('key');
			expect(currentMock.del).toHaveBeenCalledWith('test:key');
		});
	});

	describe('clear', () => {
		it('should delete all keys with the given prefix', async () => {
			await currentMock.set('test:a', '1');
			await currentMock.set('test:b', '2');
			await currentMock.set('other:c', '3');

			await cache.clear();

			expect(currentMock.keys).toHaveBeenCalledWith('test:*');
			expect(currentMock.del).toHaveBeenCalledWith('test:a', 'test:b');

			const other = await currentMock.get('other:c');
			expect(other).toBe('3');
		});

		it('should do nothing if no keys match the prefix', async () => {
			await cache.clear();
			expect(currentMock.keys).toHaveBeenCalledWith('test:*');
			expect(currentMock.del).not.toHaveBeenCalled();
		});
	});

	describe('prefix handling', () => {
		it('should use the key prefix for all operations', async () => {
			await cache.get('x');
			expect(currentMock.get).toHaveBeenCalledWith('test:x');

			await cache.set('y', { value: 1, expiry: null });
			expect(currentMock.set).toHaveBeenCalledWith(
				'test:y',
				JSON.stringify({ value: 1, expiry: null })
			);

			await cache.delete('z');
			expect(currentMock.del).toHaveBeenCalledWith('test:z');

			await cache.clear();
			expect(currentMock.keys).toHaveBeenCalledWith('test:*');
		});
	});
});

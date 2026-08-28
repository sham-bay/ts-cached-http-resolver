import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Redis from 'ioredis';
import { RedisCache } from '../../src/cache/RedisCache';
import type { CacheItem } from '../../src/types';

// Redis configuration (can be set via environment variables)
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

describe('RedisCache (integration with real Redis)', () => {
	let redisClient: Redis;
	let cache: RedisCache;

	beforeAll(async () => {
		// Create client and check connectivity
		redisClient = new Redis({ host: REDIS_HOST, port: REDIS_PORT });
		cache = new RedisCache({
			redis: redisClient,
			keyPrefix: 'test:'
		});

		// Verify that Redis is available
		try {
			await redisClient.ping();
		} catch {
			console.warn('Redis not available - skipping integration tests');
			// Skip all tests if Redis is not responding
			// Use a special marker to skip the describe block.
			// In vitest we could use .skip, but here we throw an error with a message.
			throw new Error('Redis connection failed - tests skipped', {
				cause: 'Redis connection failed '
			});
		}
	});

	afterAll(async () => {
		if (redisClient) {
			// Clean up all test keys
			const keys = await redisClient.keys('test:*');
			if (keys.length) {
				await redisClient.del(...keys);
			}
			await redisClient.quit();
		}
	});

	// Clear the cache before each test to isolate them
	beforeEach(async () => {
		await cache.clear();
	});

	describe('set and get', () => {
		it('should store and retrieve a value with null expiry', async () => {
			const item: CacheItem<number> = { value: 42, expiry: null };
			await cache.set('key', item);
			const result = await cache.get<number>('key');
			expect(result).toEqual(item);
		});

		it('should store and retrieve a value with a numeric expiry', async () => {
			const expiry = Date.now() + 10000;
			const item: CacheItem<string> = { value: 'test', expiry };
			await cache.set('key', item);
			const result = await cache.get<string>('key');
			expect(result).toEqual(item);
		});

		it('should overwrite an existing key', async () => {
			await cache.set('key', { value: 'old', expiry: null });
			await cache.set('key', { value: 'new', expiry: null });
			const result = await cache.get<string>('key');
			expect(result?.value).toBe('new');
		});

		it('should return undefined for a missing key', async () => {
			const result = await cache.get('missing');
			expect(result).toBeUndefined();
		});
	});

	describe('delete', () => {
		it('should delete a key', async () => {
			await cache.set('key', { value: 42, expiry: null });
			await cache.delete('key');
			const result = await cache.get('key');
			expect(result).toBeUndefined();
		});
	});

	describe('clear', () => {
		it('should delete all keys with the prefix', async () => {
			await cache.set('a', { value: 1, expiry: null });
			await cache.set('b', { value: 2, expiry: null });
			// Add a key without the prefix – it should not be removed
			await redisClient.set('other', 'value');

			await cache.clear();

			const a = await cache.get('a');
			const b = await cache.get('b');
			expect(a).toBeUndefined();
			expect(b).toBeUndefined();

			// The key without the prefix should remain
			const other = await redisClient.get('other');
			expect(other).toBe('value');
		});
	});

	describe('TTL behaviour', () => {
		it('should set Redis TTL when expiry is provided', async () => {
			const expiry = Date.now() + 5000; // +5 seconds
			await cache.set('ttl-key', { value: 'will-expire', expiry });

			// Verify that TTL is set (approximately 4-5 seconds)
			const ttl = await redisClient.ttl('test:ttl-key');
			expect(ttl).toBeGreaterThanOrEqual(4);
			expect(ttl).toBeLessThanOrEqual(6);
		});

		it('should not set TTL when expiry is null', async () => {
			await cache.set('no-ttl', { value: 'permanent', expiry: null });

			const ttl = await redisClient.ttl('test:no-ttl');
			// Redis returns -1 if the key has no TTL
			expect(ttl).toBe(-1);
		});
	});

	describe('prefix handling', () => {
		it('should isolate keys with different prefixes', async () => {
			const otherCache = new RedisCache({
				redis: redisClient,
				keyPrefix: 'other:'
			});

			await cache.set('shared', { value: 'from-default', expiry: null });
			await otherCache.set('shared', { value: 'from-other', expiry: null });

			const defaultResult = await cache.get<string>('shared');
			const otherResult = await otherCache.get<string>('shared');

			expect(defaultResult?.value).toBe('from-default');
			expect(otherResult?.value).toBe('from-other');
		});
	});
});

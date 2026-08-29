import type { Redis as RedisType, RedisOptions } from 'ioredis';
import type { CacheStore } from './CacheStore.js';
import type { CacheItem } from '../types/CacheItem.js';

/**
 * Configuration for the Redis cache store.
 */
export interface RedisCacheOptions {
	/**
	 * Redis connection options (passed directly to ioredis).
	 */
	redis: RedisOptions;

	/**
	 * Optional prefix applied to all keys (e.g. `'myapp:'`).
	 */
	keyPrefix?: string;
}

/**
 * Redis‑backed cache store.
 * Automatically sets Redis TTL based on the item's expiry.
 * Uses dynamic import for `ioredis` – no need to install it unless you use this store.
 */
export class RedisCache implements CacheStore {
	private redis?: RedisType;
	private prefix: string;
	private redisOptions: RedisOptions;

	constructor(options: RedisCacheOptions) {
		this.prefix = options.keyPrefix ?? '';
		this.redisOptions = options.redis;
	}

	/**
	 * Ensures Redis client is initialized.
	 * Dynamically imports `ioredis` only when needed.
	 */
	private async ensureRedis(): Promise<RedisType> {
		if (!this.redis) {
			// Dynamic import of ioredis
			const module = await import('ioredis');
			// For ESM: default export is the class; for CJS: fallback to module itself
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const Redis = (module as any).default ?? module;
			if (typeof Redis !== 'function') {
				throw new Error('ioredis module does not export a constructor');
			}
			// Create instance; `as any` suppresses type errors but runtime is guaranteed
			this.redis = new Redis(this.redisOptions);
		}
		return this.redis as RedisType;
	}

	private buildKey(key: string): string {
		return this.prefix + key;
	}

	/** @inheritdoc */
	async get<T>(key: string): Promise<CacheItem<T> | undefined> {
		const client = await this.ensureRedis();
		const raw = await client.get(this.buildKey(key));
		if (!raw) return undefined;
		try {
			return JSON.parse(raw) as CacheItem<T>;
		} catch {
			return undefined;
		}
	}

	/** @inheritdoc */
	async set<T>(key: string, item: CacheItem<T>): Promise<void> {
		const client = await this.ensureRedis();
		const serialized = JSON.stringify(item);
		const fullKey = this.buildKey(key);
		if (item.expiry !== null) {
			const ttlSeconds = Math.max(1, Math.floor((item.expiry - Date.now()) / 1000));
			await client.set(fullKey, serialized, 'EX', ttlSeconds);
		} else {
			await client.set(fullKey, serialized);
		}
	}

	/** @inheritdoc */
	async delete(key: string): Promise<void> {
		const client = await this.ensureRedis();
		await client.del(this.buildKey(key));
	}

	/** @inheritdoc */
	async clear(): Promise<void> {
		const client = await this.ensureRedis();
		const pattern = this.buildKey('*');
		const keys = await client.keys(pattern);
		if (keys.length) {
			await client.del(...keys);
		}
	}
}

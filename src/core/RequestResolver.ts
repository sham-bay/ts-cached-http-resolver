import type { CacheItem, RequestConfig, RetryOptions } from '../types';
import type { CacheStore } from '../cache/CacheStore';
import { checkResponse } from '../utils/checkResponse';
import { retryWithExponentialBackoff } from '../utils/retryWithExponentialBackoff';

/**
 * Universal HTTP client with caching, deduplication, pre‑emptive refresh and retries.
 * The cache store is pluggable (e.g. MemoryCache, RedisCache).
 */
export class RequestResolver {
	private cacheStore: CacheStore;
	private pendingRequests = new Map<string, Promise<unknown>>();
	private defaultRetryOptions: Required<RetryOptions>;

	/**
	 * Creates a new RequestResolver instance.
	 *
	 * @param cacheStore - The cache storage backend.
	 * @param defaultRetryOptions - Global retry defaults (overridden per request).
	 */
	constructor(cacheStore: CacheStore, defaultRetryOptions?: RetryOptions) {
		this.cacheStore = cacheStore;
		this.defaultRetryOptions = {
			maxRetries: defaultRetryOptions?.maxRetries ?? 3,
			baseDelay: defaultRetryOptions?.baseDelay ?? 1000,
			useExponential: defaultRetryOptions?.useExponential ?? true
		};
	}

	// ----- Public cache operations -----

	/**
	 * Manually store a value in the cache.
	 *
	 * @param key - Cache key.
	 * @param value - Value to store.
	 * @param ttlSeconds - Time‑to‑live in seconds, or `null` for permanent.
	 */
	public async setCacheItem<T>(key: string, value: T, ttlSeconds: number | null): Promise<void> {
		const expiry = ttlSeconds !== null ? Date.now() + ttlSeconds * 1000 : null;
		await this.cacheStore.set(key, { value, expiry });
	}

	/**
	 * Retrieves the full CacheItem (value + expiry) from the cache.
	 * Expired items are removed.
	 *
	 * @param key - Cache key.
	 * @returns The CacheItem, or `undefined`.
	 */
	public async getCacheItem<T>(key: string): Promise<CacheItem<T> | undefined> {
		const item = await this.cacheStore.get<T>(key);
		if (!item) {
			return undefined;
		}
		if (item.expiry && item.expiry < Date.now()) {
			await this.cacheStore.delete(key);
			return undefined;
		}
		return item;
	}

	/**
	 * Clear the cache – either a specific key or the entire store.
	 *
	 * @param key - Optional key. If omitted, clears everything.
	 */
	public async clearCache(key?: string): Promise<void> {
		if (key) {
			await this.cacheStore.delete(key);
		} else {
			await this.cacheStore.clear();
		}
	}

	/**
	 * Debug helper: prints current cache contents.
	 * Only works if the store supports `entries()`.
	 */
	public async showCacheStorage(): Promise<void> {
		console.log('Cache contents:');
		if (this.cacheStore.entries) {
			const entries = await this.cacheStore.entries();
			if (entries.length === 0) {
				console.log('  (empty)');
			} else {
				entries.forEach(([key, item]) => {
					console.log(`  [${key}]`, item);
				});
			}
		} else {
			console.log('  (entries not available for this cache store)');
		}
	}

	// ----- Helpers -----

	/**
	 * Determines the key used for deduplication.
	 * Prefers `requestKey`, falls back to `cacheKey`, else `null`.
	 */
	private getDedupeKey(config: RequestConfig): string | null {
		return config.requestKey ?? config.cacheKey ?? null;
	}

	/**
	 * Resolves the TTL (in seconds) from the response data.
	 * Uses `ttlResolver` if provided, otherwise `cacheTTL`, otherwise `null` (permanent).
	 */
	private resolveTTL(data: unknown, config: RequestConfig): number | null {
		if (config.ttlResolver) {
			const ttl = config.ttlResolver(data);
			if (ttl !== undefined && ttl !== null) {
				return ttl;
			}
		}
		return config.cacheTTL ?? null;
	}

	// ----- Main request method -----

	/**
	 * Performs an HTTP request with caching, deduplication and retries.
	 *
	 * @param url - Request URL.
	 * @param options - Standard fetch options (method, headers, body, etc.).
	 * @param config - Caching, dedupe, hook and retry settings.
	 * @returns A Promise resolving to the parsed JSON response (type `T`).
	 * @template T - Expected response type.
	 */
	public async request<T = unknown>(
		url: string,
		options: RequestInit = {},
		config: RequestConfig = {}
	): Promise<T> {
		const dedupeKey = this.getDedupeKey(config);
		const bufferMs = (config.refreshBufferSeconds ?? 300) * 1000;
		const now = Date.now();

		// bufferMs is used to refresh the cached value before it expires
		// e.g., refresh a token 5 minutes before its expiry

		// 1. Check cache (with refresh buffer)
		if (config.cacheKey) {
			const cachedItem = await this.getCacheItem<T>(config.cacheKey);
			if (cachedItem) {
				// Never‑expiring – return immediately
				if (cachedItem.expiry === null) {
					return cachedItem.value;
				}
				// Still far from expiry – return cached value
				if (cachedItem.expiry - now > bufferMs) {
					return cachedItem.value;
				}
				// Otherwise, the item is stale or about to expire – we will refresh
				// (do not return the stale value; make a fresh request)
			}
		}

		// 2. Deduplicate in‑flight requests
		if (dedupeKey) {
			const existing = this.pendingRequests.get(dedupeKey);
			if (existing) {
				// Return the existing Promise – this blocks until the first request completes
				// (to avoid parallel updates if it's a refresh request)
				return existing as Promise<T>;
			}
		}

		// 3. Build the operation (with retries)
		const operation = async (): Promise<T> => {
			if (config.onBefore) {
				await config.onBefore(url, options);
			}

			const response = await fetch(url, options);
			await checkResponse(response, `Request to ${url} failed`);
			const data = await response.json();

			if (config.onAfter) {
				await config.onAfter(response, data);
			}
			return data;
		};

		const retryOpts = { ...this.defaultRetryOptions, ...config.retryOptions };

		const executeWithRetry = async (): Promise<T> => {
			return retryWithExponentialBackoff(
				operation,
				retryOpts.maxRetries,
				retryOpts.baseDelay,
				retryOpts.useExponential,
				config.onError
			);
		};

		// 4. Start the request and register in pending (if dedupe key exists)
		let requestPromise: Promise<T>;

		if (dedupeKey) {
			requestPromise = executeWithRetry().finally(() => {
				this.pendingRequests.delete(dedupeKey);
			});
			this.pendingRequests.set(dedupeKey, requestPromise);
		} else {
			requestPromise = executeWithRetry();
		}

		// 5. Wait for the result
		const result = await requestPromise;

		// 6. Store the result in cache (if cacheKey provided)
		if (config.cacheKey) {
			const ttl = this.resolveTTL(result, config);
			await this.setCacheItem(config.cacheKey, result, ttl);
		}

		return result;
	}
}

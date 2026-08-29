# TypeScript Cached Http Resolver

[![npm version](https://badge.fury.io/js/%40shambay%2Fcached-http-resolver.svg)](https://badge.fury.io/js/%40shambay%2Fcached-http-resolver)
[![Publish to npm](https://github.com/sham-bay/ts-cached-http-resolver/actions/workflows/publish-to-npm.yml/badge.svg)](https://github.com/sham-bay/ts-cached-http-resolver/actions/workflows/publish-to-npm.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

HTTP client with caching, deduplication, pre‑emptive refresh and retries.

Pluggable cache stores (`memory` / `Redis`) – perfect for single‑process and distributed environments.

## Features

- Caching with TTL, dynamic TTL, refresh buffer
- Request deduplication
- Retries with exponential backoff
- Hooks (before, after, error)
- Pluggable cache (MemoryCache, RedisCache, or custom)
- Fully typed

## Installation

```bash
npm install @shambay/cached-http-resolver

# optional for Redis:
npm install ioredis
```

## Quick Start

```typescript
import { RequestResolver, createCacheStore } from '@shambay/cached-http-resolver';

const cache = createCacheStore('memory');
const client = new RequestResolver(cache);

const data = await client.request(
	'https://api.example.com/users',
	{}, // options, - headers, method
	{
		cacheKey: 'users',
		cacheTTL: 60
	}
);
```

For Redis:

```typescript
const cache = createCacheStore('redis', {
	redis: { host: 'localhost', port: 6379 },
	keyPrefix: 'myapp:'
});
```

## License

Apache 2.0 © [Sham Bay](https://github.com/sham-bay)

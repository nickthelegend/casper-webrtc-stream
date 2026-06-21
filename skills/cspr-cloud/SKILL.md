---
name: cspr-cloud
description: Use when answering questions, writing code, or building examples for CSPR.cloud REST API, CSPR.cloud Streaming API, Casper Network indexed data, pagination, filtering, sorting, includes, API errors, account/contract/token/NFT/rate endpoints, Casper Node proxy access, or WebSocket subscriptions.
source: https://cspr.cloud/skill.md
saved: 2026-06-21
---

# CSPR.cloud API

Use this skill for CSPR.cloud API integrations. Keep responses grounded in the public documentation; do not invent endpoints, query parameters, includes, response fields, stream actions, or error codes.

Public docs base: `https://docs.cspr.cloud/`. Append `.md` to a page path and add `?displayAgentInstructions=false` to get Markdown — e.g. `/rest-api/block` → `https://docs.cspr.cloud/rest-api/block.md?displayAgentInstructions=false`.

## Core URLs

Mainnet:
- REST API: `https://api.cspr.cloud`
- Streaming API: `wss://streaming.cspr.cloud`
- Casper Node RPC API: `https://node.cspr.cloud`
- Casper Node SSE API: `https://node-sse.cspr.cloud`

Testnet:
- REST API: `https://api.testnet.cspr.cloud`
- Streaming API: `wss://streaming.testnet.cspr.cloud`
- Casper Node RPC API: `https://node.testnet.cspr.cloud`
- Casper Node SSE API: `https://node-sse.testnet.cspr.cloud`

Prefer Testnet URLs in examples unless the user asks for Mainnet.

## Authentication

Every CSPR.cloud REST, Streaming, Casper Node RPC, and Casper Node SSE request requires an `Authorization` header containing the access token. Obtain one at `https://cspr.cloud/`. Never invent tokens.

```bash
export CSPR_CLOUD_API_KEY="your-access-token"
```

Use `Authorization: $CSPR_CLOUD_API_KEY`. Do NOT put access tokens in frontend/browser code or commit them. Read the token at runtime and fail fast if missing.

## REST behavior

- HTTP JSON API for indexed Casper data. Successful responses wrap payloads in `data`.
- Paginated responses include `data`, `item_count`, `page_count`. Use `page` and `page_size` (default page 1, default size 10, max 250).
- Sorting: `order_by` + `order_direction` (ASC/DESC), endpoint-specific.
- Filtering: endpoint-specific query params; some accept comma-separated values.
- Optional properties via `includes` (scalar, related objects, field selections, or functions like `rate(1)`). Field-selection syntax: `includes=account_info{info{owner{name,branding{logo}}}}`.
- Treat numeric blockchain amounts as strings. Handle `429` with backoff.

## Error handling

Errors return an `error` object with `code` + `message`. Known codes: `invalid_input` (400), `unauthorized` (401), `access_denied` (403), `not_found` (404), `duplicate_entity` (409). Parse `error.code`.

## Streaming behavior

WebSocket; messages are JSON with `action`, `data`, `timestamp`, optional `extra`. Reconnect on close, deduplicate by entity id, update events fire only for direct property changes. `Persistent-Session` header (non-Free tiers) for stable sessions.

## Endpoint selection

1. REST: use the topic page if the domain is obvious, else `/rest-api/reference`.
2. Streaming: start from `/streaming-api/reference`.
3. Node RPC/SSE: `/casper-node-api/connecting-with-an-sdk`.
4. Open the specific endpoint page; use only documented params/fields.

REST topic entry points include: `/rest-api/account`, `/rest-api/contract`, `/rest-api/contract-package`, `/rest-api/deploy`, `/rest-api/fungible-token-ownership`, `/rest-api/transfer`, `/rest-api/cspr-rate`, and more (see the full index at the source URL above).

## In THIS project

We use CSPR.cloud for: the x402 facilitator (`https://x402-facilitator.cspr.cloud`), and the Casper testnet node RPC (`https://node.testnet.cspr.cloud`) for Odra Livenet deploys. The API key is server-side only (provider `/api/verify` + `/api/settle`).

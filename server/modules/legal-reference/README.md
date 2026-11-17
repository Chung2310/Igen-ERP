# Văn bản pháp luật

Module stores source metadata and immutable source files per tenant. It extracts legal structure, maintains version history, queues uncertain extraction or amendment links for review, and searches chunks for an as-of date. Answer generation uses the shared OpenRouter service and includes only citations to retrieved chunks.

## VBPL synchronization

The connector uses the Bộ Tư pháp data sharing endpoints for full-text search, document detail and attachment download. Register those services in the MOJ data sharing portal and provide the issued user key through server environment configuration. The key is never stored in MongoDB or sent to the browser.

Configure these variables in the server environment:

```dotenv
VBPL_USER_KEY=
VBPL_SYNC_SCOPES_JSON=[{"jurisdiction":"central","donViIds":[13],"documentTypeIds":[],"documentKinds":[1,3]}]
VBPL_SYNC_INTERVAL_MS=21600000
VBPL_SYNC_PAGE_LIMIT=2
VBPL_SYNC_PAGE_SIZE=50
```

`VBPL_SYNC_SCOPES_JSON` accepts an array with `jurisdiction` (`central`, `ministry` or `local`), MOJ `donViIds`, optional `documentTypeIds`, document kinds (`1` standard legal texts, `2` temporary entries, `3` consolidated texts), and an optional `province` label. Add one entry for each selected scope. Confirm the IDs and service access with MOJ before enabling a scope.

Optional service URLs default to the official endpoints currently listed by MOJ:

- `VBPL_SYNC_SEARCH_URL=https://data.moj.gov.vn/api/v1/publising/lgsp/redirect/tim-kiem-van-ban`
- `VBPL_SYNC_DETAIL_URL=https://data.moj.gov.vn/api/v1/publising/lgsp/redirect/chi-tiet-van-ban`
- `VBPL_SYNC_ATTACHMENTS_URL=https://data.moj.gov.vn/api/v1/publising/lgsp/redirect/tai-file-dinh-kem`

The scheduler scans the next batch of pages for each configured scope and persists a page cursor per scope. It rotates to the first page after reaching the end, so periodic runs also revisit older records. Increase `VBPL_SYNC_PAGE_LIMIT` during an initial backfill, then lower it to a steady-state batch size. The module's “Đồng bộ VBPL ngay” control can start an immediate batch for the current tenant.

New source records are de-duplicated by tenant and source ID/symbol. File hashes prevent duplicate versions. A changed source file is stored as a pending version and is excluded from retrieval until an administrator confirms its effective date. If the portal provides no PDF/Word attachment but does provide its full-text HTML, that exact HTML response is preserved as the source snapshot and extracted into searchable text. If neither is available, the record is counted as missing an original and can be added manually.

Embeddings use the ERP's deterministic 96-dimension token-hash method and combine with keyword matching. They provide an inexpensive local ranking signal; they are not a hosted transformer embedding model. The answer route calls the configured OpenRouter/FreeLLM text service and instructs it to cite retrieved source entries.

## Official references

- [MOJ data sharing services](https://data.moj.gov.vn/dich-vu-chia-se)
- [VBPL national legal database](https://vbpl.moj.gov.vn)

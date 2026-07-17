# Comprehensive staging load test

This tooling targets only `https://staging-erp.igentechsolutions.com`. Runtime credentials and bypass secrets must be provided through the process environment and are never written to manifests.

## Staging server prerequisite

Deploy the branch to staging with:

- `NODE_ENV=staging` (the bypass is disabled when it equals `production`)
- `LOAD_TEST_BYPASS_SECRET=<random value of at least 32 characters>`

Do not configure the bypass secret on production. Restart staging after adding or removing it. Remove the secret and return the normal staging environment after testing.

## Local runtime variables

Set these only in the current shell or a private ignored `.env` file:

- `LOAD_TEST_CONFIRM=STAGING_ONLY`
- `LOAD_TEST_RUN_ID=<unique alphanumeric-hyphen id>`
- `LOAD_TEST_ADMIN_EMAIL=<staging admin email>`
- `LOAD_TEST_ADMIN_PASSWORD=<staging admin password>`
- `LOAD_TEST_USER_PASSWORD=<password used only by generated users>`
- `LOAD_TEST_BYPASS_SECRET=<same staging-only secret>`

## Gated sequence for the next session

1. Create five users: `npm run load:setup -- --users 5`.
2. Run the five-user profile only after reviewing the manifest under `tmp/load-tests/`.
3. Clean up: `npm run load:cleanup`.
4. Verify all five users were removed before provisioning the full pool.
5. Create the full pool: `npm run load:setup -- --users 1000`.
6. Run: `npm run load:run` while monitoring VPS, Nginx, Node.js, Redis, and MongoDB.
7. Always run `npm run load:cleanup`, including after an interrupted test.

The setup, run, and cleanup commands refuse to start without the confirmation string, run ID, credentials, and a sufficiently long bypass secret.

import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

// The frontend API routes are Next.js modules whose package has no
// "type": "module", so they load through tsx's require hook rather than a
// static ESM import, mirroring how the backend package runs its tsx tests.
const require = createRequire(import.meta.url);
const { GET: leaderboardGET } = require(
  "../packages/frontend/src/app/api/leaderboard/route.ts",
) as { GET: (request: Request) => Promise<Response> };
const { GET: mayhemGET } = require(
  "../packages/frontend/src/app/api/mayhem-screener/route.ts",
) as { GET: (request: Request) => Promise<Response> };

// No developer API key: a page that passes validation reaches the
// credential check (503), while a rejected page stops at 400.
delete process.env.PUMPFUN_DEVELOPER_API_KEY;

test("leaderboard page rejects non-decimal integer literals", async () => {
  for (const page of ["0x10", "1e1", "010", " 10 ", "+10"]) {
    const response = await leaderboardGET(
      new Request(
        `http://x/api/leaderboard?page=${encodeURIComponent(page)}`,
      ),
    );
    const body = (await response.json()) as {
      error?: { code?: string };
    };
    assert.equal(response.status, 400, `page=${page}`);
    assert.equal(body.error?.code, "INVALID_PAGE", `page=${page}`);
  }
  const valid = await leaderboardGET(
    new Request("http://x/api/leaderboard?page=10"),
  );
  const validBody = (await valid.json()) as { error?: { code?: string } };
  assert.equal(valid.status, 503);
  assert.equal(validBody.error?.code, "DATA_SOURCE_UNAVAILABLE");
});

test("mayhem limit and offset reject non-decimal integer literals", async () => {
  for (const query of ["limit=0x10", "limit=1e1", "limit=010", "offset=0x10"]) {
    const response = await mayhemGET(
      new Request(`http://x/api/mayhem-screener?${query}`),
    );
    const body = (await response.json()) as { code?: string };
    assert.equal(response.status, 400, query);
    assert.equal(body.code, "INVALID_MAYHEM_QUERY", query);
  }
  const valid = await mayhemGET(
    new Request("http://x/api/mayhem-screener?limit=60&offset=10"),
  );
  const validBody = (await valid.json()) as { code?: string };
  assert.equal(valid.status, 503);
  assert.equal(validBody.code, "MAYHEM_DATA_UNAVAILABLE");
});

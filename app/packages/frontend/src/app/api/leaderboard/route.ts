import {
  competitionStatuses,
  creatorPeriods,
  leaderboardCategories,
  traderPeriods,
  traderSorts,
  type LeaderboardFailure,
} from "../../leaderboard/types";
import {
  CREATOR_PAGE_SIZE,
  DEVELOPER_API_ORIGIN,
  normalizeUpstreamResponse,
  readBoundedJson,
  UpstreamValidationError,
} from "./upstream";

export const dynamic = "force-dynamic";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_PAGE = 500;
const COMPETITION_ID = /^[A-Za-z0-9_-]{1,120}$/;

function failure(
  status: number,
  code: string,
  message: string,
  retryable: boolean,
  mode: "offline" | "developer-api" = "developer-api",
) {
  const payload: LeaderboardFailure = {
    ok: false,
    error: { code, message, retryable },
    source: {
      mode,
      label:
        mode === "offline"
          ? "Developer API credential not configured"
          : "Pump developer API",
    },
  };
  return Response.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function oneOf<T extends readonly string[]>(
  value: string | null,
  values: T,
  fallback: T[number],
): T[number] | null {
  if (value === null) return fallback;
  return values.includes(value as T[number]) ? (value as T[number]) : null;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  for (const key of ["category", "page", "period", "sort", "status", "id"]) {
    if (requestUrl.searchParams.getAll(key).length > 1) {
      return failure(400, "INVALID_QUERY", "Leaderboard parameters must occur once.", false);
    }
  }
  const category = oneOf(
    requestUrl.searchParams.get("category"),
    leaderboardCategories,
    "traders",
  );
  if (!category) {
    return failure(
      400,
      "INVALID_CATEGORY",
      "Unknown leaderboard category.",
      false,
    );
  }

  const rawPage = requestUrl.searchParams.get("page") ?? "1";
  // Pages are plain decimal literals: Number() would also accept hex (0x10),
  // exponents (1e1), leading zeros, surrounding whitespace and a leading +,
  // so a non-decimal literal must fail here instead of reaching the upstream
  // query as a different page.
  const pageValue = /^(?:0|[1-9][0-9]*)$/.test(rawPage)
    ? Number(rawPage)
    : NaN;
  const page =
    Number.isInteger(pageValue) && pageValue >= 1 && pageValue <= MAX_PAGE
      ? pageValue
      : null;
  if (!page) {
    return failure(
      400,
      "INVALID_PAGE",
      `Page must be from 1 to ${MAX_PAGE}.`,
      false,
    );
  }

  let upstreamUrl: URL;
  let competitionId: string | null = null;
  if (category === "traders") {
    const period = oneOf(
      requestUrl.searchParams.get("period"),
      traderPeriods,
      "daily",
    );
    const sort = oneOf(
      requestUrl.searchParams.get("sort"),
      traderSorts,
      "combined",
    );
    if (!period || !sort) {
      return failure(
        400,
        "INVALID_FILTER",
        "Invalid trader period or sort.",
        false,
      );
    }
    upstreamUrl = new URL("/v1/pnl-leaderboard", DEVELOPER_API_ORIGIN);
    upstreamUrl.searchParams.set("period", period);
    upstreamUrl.searchParams.set("sort", sort);
    upstreamUrl.searchParams.set("limit", "100");
    upstreamUrl.searchParams.set("positionsLimit", "0");
  } else if (category === "creators") {
    const period = oneOf(
      requestUrl.searchParams.get("period"),
      creatorPeriods,
      "all",
    );
    if (!period) {
      return failure(400, "INVALID_FILTER", "Invalid payout period.", false);
    }
    upstreamUrl = new URL("/v1/payouts/leaderboard", DEVELOPER_API_ORIGIN);
    upstreamUrl.searchParams.set("page", String(page - 1));
    upstreamUrl.searchParams.set("pageSize", String(CREATOR_PAGE_SIZE));
    if (period !== "all") upstreamUrl.searchParams.set("period", period);
  } else {
    const status = oneOf(
      requestUrl.searchParams.get("status"),
      competitionStatuses,
      "live",
    );
    if (!status) {
      return failure(
        400,
        "INVALID_FILTER",
        "Invalid competition status.",
        false,
      );
    }
    competitionId = requestUrl.searchParams.get("id");
    if (competitionId !== null && !COMPETITION_ID.test(competitionId)) {
      return failure(
        400,
        "INVALID_COMPETITION",
        "Invalid competition identifier.",
        false,
      );
    }
    upstreamUrl = new URL(
      competitionId
        ? `/v1/competitions/${encodeURIComponent(competitionId)}`
        : "/v1/competitions",
      DEVELOPER_API_ORIGIN,
    );
    if (competitionId) {
      upstreamUrl.searchParams.set("limit", "100");
      upstreamUrl.searchParams.set("positionsLimit", "0");
    }
  }

  const apiKey = process.env.PUMPFUN_DEVELOPER_API_KEY?.trim();
  if (!apiKey) {
    return failure(
      503,
      "DATA_SOURCE_UNAVAILABLE",
      "Live rankings require a developer API key. This local reconstruction does not ship credentials or substitute rankings.",
      true,
      "offline",
    );
  }

  const timeoutSignal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = AbortSignal.any([request.signal, timeoutSignal]);
  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
      redirect: "error",
      signal,
    });

    if (!upstream.ok) {
      // Release unused error bodies without replacing the HTTP failure.
      await upstream.body?.cancel().catch(() => undefined);
      if (upstream.status === 429) {
        return failure(
          429,
          "RATE_LIMITED",
          "The developer API rate limit was reached. Try again later.",
          true,
        );
      }
      if (upstream.status === 401 || upstream.status === 403) {
        return failure(
          503,
          "DATA_SOURCE_UNAUTHORIZED",
          "The configured developer API credential cannot read leaderboard data.",
          false,
        );
      }
      return failure(
        upstream.status === 503 ? 503 : 502,
        "UPSTREAM_FAILURE",
        "The developer API could not serve leaderboard data.",
        true,
      );
    }

    const raw = await readBoundedJson(upstream);
    const data = normalizeUpstreamResponse(category, raw, {
      page,
      competitionId,
    });
    return Response.json(
      {
        ok: true,
        data,
        source: {
          mode: "developer-api",
          label: "Pump developer API",
          fetchedAt: new Date().toISOString(),
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof UpstreamValidationError) {
      return failure(
        502,
        "INVALID_UPSTREAM_RESPONSE",
        "The developer API returned data that did not match the captured contract.",
        true,
      );
    }
    if (signal.aborted) {
      return failure(
        504,
        "UPSTREAM_TIMEOUT",
        "The leaderboard request timed out.",
        true,
      );
    }
    return failure(
      502,
      "NETWORK_FAILURE",
      "The leaderboard data source could not be reached.",
      true,
    );
  }
}

import { NextResponse } from "next/server";
import {
  buildMayhemQuery,
  normalizeMayhemFilter,
} from "../../mayhem/mayhem-data";

export function GET(request: Request) {
  const incoming = new globalThis.URL(request.url);
  const filter = normalizeMayhemFilter(
    incoming.searchParams.get("filter") ?? undefined,
  );

  try {
    // Limit and offset are plain decimal literals: Number() would also accept
    // hex (0x10), exponents (1e1), leading zeros and surrounding whitespace,
    // so a non-decimal literal must fail here instead of being served as a
    // different page.
    const limitText = incoming.searchParams.get("limit");
    const offsetText = incoming.searchParams.get("offset");
    if (
      (limitText !== null && !/^(?:0|[1-9][0-9]*)$/.test(limitText)) ||
      (offsetText !== null && !/^(?:0|[1-9][0-9]*)$/.test(offsetText))
    ) {
      throw new Error("Mayhem limit and offset must be plain decimal integers");
    }
    buildMayhemQuery({
      filter,
      limit: Number(limitText ?? 60),
      offset: Number(offsetText ?? 0),
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "INVALID_MAYHEM_QUERY",
        message:
          error instanceof Error ? error.message : "Invalid Mayhem query",
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    {
      code: "MAYHEM_DATA_UNAVAILABLE",
      message:
        "No archived Mayhem coin response or qualified live data adapter is available.",
    },
    { status: 503, headers: { "Retry-After": "60" } },
  );
}

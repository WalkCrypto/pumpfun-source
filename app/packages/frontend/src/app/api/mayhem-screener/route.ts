import { NextResponse } from "next/server";
import {
  buildMayhemQuery,
  normalizeMayhemFilter,
} from "../../mayhem/mayhem-data";

export function GET(request: Request) {
  const incoming = new globalThis.URL(request.url);
  for (const key of incoming.searchParams.keys()) {
    if (!["filter", "limit", "offset"].includes(key)) {
      return NextResponse.json(
        {
          code: "INVALID_MAYHEM_QUERY",
          message: "Unknown Mayhem query parameter.",
        },
        { status: 400 },
      );
    }
  }
  const filter = normalizeMayhemFilter(
    incoming.searchParams.get("filter") ?? undefined,
  );

  try {
    buildMayhemQuery({
      filter,
      limit: Number(incoming.searchParams.get("limit") ?? 60),
      offset: Number(incoming.searchParams.get("offset") ?? 0),
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

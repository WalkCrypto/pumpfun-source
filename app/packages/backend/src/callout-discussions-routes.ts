import type { FastifyInstance } from "fastify";
import {
  CalloutDiscussionError,
  type CalloutDiscussionsStore,
} from "./callout-discussions-store.js";
import { errorBody } from "./users-routes.js";
export const CALLOUT_DISCUSSIONS_NATIVE_ROUTES = new Set([
  "GET /callout/{calloutId}/replies",
  "GET /callout/replies/{replyId}/chain",
]);
export function registerCalloutDiscussionRoutes(
  app: FastifyInstance,
  store: CalloutDiscussionsStore,
): void {
  const queryOf = (url: string) => {
    const start = url.indexOf("?");
    return new URLSearchParams(start < 0 ? "" : url.slice(start + 1));
  };
  for (const [path, read] of [
    [
      "/v1/callout/:calloutId/replies",
      (params: Record<string, string>, query: URLSearchParams) =>
        store.list(params.calloutId, query),
    ],
    [
      "/v1/callout/replies/:replyId/chain",
      (params: Record<string, string>, query: URLSearchParams) => {
        if (query.size)
          throw new CalloutDiscussionError(
            501,
            "CALLOUT_DISCUSSION_QUERY_UNSUPPORTED",
          );
        return store.chain(params.replyId);
      },
    ],
  ] as const)
    app.get(path, async (request, reply) => {
      try {
        const response = read(
          request.params as Record<string, string>,
          queryOf(request.url),
        );
        return reply
          .header("X-Reconstruction-Data-Source", store.dataSource)
          .header("X-Reconstruction-Observed-At", store.observedAt)
          .header("X-Reconstruction-Compatibility", "unqualified")
          .send(response);
      } catch (error) {
        if (!(error instanceof CalloutDiscussionError)) throw error;
        return reply
          .code(error.status)
          .send(errorBody(
            error.status,
            error.status === 501 ? "COMPATIBILITY_NOT_IMPLEMENTED" : "BAD_REQUEST",
            { reason: error.reason },
          ));
      }
    });
}

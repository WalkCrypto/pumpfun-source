/**
 * Native moderation read-operation routes.
 *
 * Registered as native Fastify handlers taking priority over the generic fixture-replay loop.
 * Ban state comes from the in-memory UserStore, the same source the users
 * overview reads its banned flag from.
 */
import type { FastifyInstance } from 'fastify';
import { UserStore, defaultStore } from './users-store.js';
import { sendSynthetic, errorBody, rejectDuplicateQueryKeys } from './users-routes.js';

export function registerModerationRoutes(
  app: FastifyInstance,
  store: UserStore = defaultStore,
): void {
  /**
   * GET /v1/moderation/ban/address/:address
   * Check whether a wallet address is banned.
   * Returns: 200, a bare boolean — true while the address is banned, false
   * otherwise. Never null, so an unknown address (or a user id, which is
   * not an address) reads as false rather than 404.
   */
  app.get('/v1/moderation/ban/address/:address', async (request, reply) => {
    if (rejectDuplicateQueryKeys(request, reply)) return reply;
    // The contract declares no query parameters for this operation, so any
    // query key is unsupported input, not a filter to ignore — the same gap
    // the other no-parameter GETs closed. The duplicate guard above still runs first.
    if (request.url.includes('?')) {
      return reply.code(501).send(errorBody(501, 'COMPATIBILITY_NOT_IMPLEMENTED', {
        reason: 'MODERATION_BAN_QUERY_UNSUPPORTED',
      }));
    }
    const { address } = request.params as { address: string };
    const user = store.getById(address);
    // getById also resolves user ids; only trust a row whose address matches
    // exactly, so a user id never reads as its owner's ban state.
    const banned = user !== undefined && user.address === address && user.is_banned === true;
    return sendSynthetic(reply, 200, banned);
  });
}

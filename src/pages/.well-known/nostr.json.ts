import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const { handle, pubkey } = site.identity.nostr;
  return new Response(JSON.stringify({
    names: { [handle]: pubkey, _: pubkey },
    relays: {},
  }));
};

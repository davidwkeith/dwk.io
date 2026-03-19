import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  return new Response(site.identity.atprotoDid);
};

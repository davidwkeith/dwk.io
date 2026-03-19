import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify({
    gpc: true,
    lastUpdate: new Date().toISOString().split('T')[0],
  }));
};

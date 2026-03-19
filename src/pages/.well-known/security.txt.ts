import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  return new Response(`Contact: ${site.identity.securityContact}
Expires: ${expires.toISOString()}
Preferred-Languages: ${site.language}
Canonical: ${site.url}/.well-known/security.txt`);
};

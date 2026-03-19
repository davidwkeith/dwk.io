import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const domain = new URL(site.url).hostname;
  return new Response(JSON.stringify({
    "@context": ["https://www.w3.org/ns/did/v1", "https://w3id.org/security/suites/ed25519-2020/v1"],
    id: `did:web:${domain}`,
    service: site.identity.didDocument.services.map(s => ({
      id: `did:web:${domain}#${s.id}`,
      type: s.type,
      serviceEndpoint: s.endpoint,
    })),
  }));
};

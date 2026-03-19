import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/jrd+json" template="${site.url}/.well-known/webfinger?resource={uri}"/>
</XRD>`);
};

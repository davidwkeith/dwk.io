import type { EleventyData } from '../types.ts';

/**
 * Host metadata for Fediverse WebFinger discovery bootstrap.
 *
 * @see https://www.rfc-editor.org/rfc/rfc6415
 */
export default class HostMeta {

  data() {
    return {
      permalink: "/.well-known/host-meta",
      eleventyExcludeFromCollections: true,
      eleventyAllowMissingExtension: true,
    };
  }

  render(data: EleventyData): string {
    const host = new URL(data.site.url).origin;
    return `<?xml version="1.0" encoding="UTF-8"?>
<XRD xmlns="http://docs.oasis-open.org/ns/xri/xrd-1.0">
  <Link rel="lrdd" type="application/jrd+json" template="${host}/.well-known/webfinger?resource={uri}"/>
</XRD>`;
  }
}

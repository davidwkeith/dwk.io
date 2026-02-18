/**
 * W3C Decentralized Identifier (DID) document using the did:web method.
 * Establishes did:web:dwk.io as a decentralized identifier.
 *
 * @see https://www.w3.org/TR/did-1.1/
 * @see https://w3c-ccg.github.io/did-method-web/
 */
export default class DIDDocument {

  data() {
    return {
      permalink: "/.well-known/did.json",
      eleventyExcludeFromCollections: true,
    };
  }

  render(data) {
    const hostname = new URL(data.site.url).hostname;
    const did = `did:web:${hostname}`;
    const { handle, instance } = data.site.mastodon;

    const document = {
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/ed25519-2020/v1",
      ],
      id: did,
      service: [
        {
          id: `${did}#website`,
          type: "LinkedDomains",
          serviceEndpoint: `https://${hostname}`,
        },
        {
          id: `${did}#mastodon`,
          type: "LinkedDomains",
          serviceEndpoint: `https://${instance}/@${handle}`,
        },
        {
          id: `${did}#bluesky`,
          type: "LinkedDomains",
          serviceEndpoint: `https://bsky.app/profile/${hostname}`,
        },
      ],
    };

    return JSON.stringify(document, null, 2);
  }
}

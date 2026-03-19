import type { APIRoute } from 'astro';
import { site } from '../../data/site';

export const GET: APIRoute = () => {
  const { handle, instance } = site.identity.webfinger;

  return new Response(JSON.stringify({
    subject: `acct:${handle}@${instance}`,
    aliases: [`https://${instance}/@${handle}`, `https://${instance}/users/${handle}`],
    links: [
      { rel: "http://webfinger.net/rel/profile-page", type: "text/html", href: `https://${instance}/@${handle}` },
      { rel: "self", type: "application/activity+json", href: `https://${instance}/users/${handle}` },
      { rel: "http://ostatus.org/schema/1.0/subscribe", template: `https://${instance}/authorize_interaction?uri={uri}` },
    ],
  }));
};

// Redirect www.dwk.io/* to dwk.io/* (a cross-host redirect, which the
// Workers Static Assets `_redirects` file does not support), then serve
// everything else from the static assets.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};

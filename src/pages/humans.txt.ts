import type { APIRoute } from 'astro';
import { execFileSync } from 'node:child_process';

function getCommitHash(): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  } catch {
    return 'unknown';
  }
}

export const GET: APIRoute = () => {
  const now = new Date();
  const buildDate = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: 'numeric', timeZoneName: 'short', timeZone: 'UTC',
  });

  return new Response(`/* TEAM */
\tDavid W. Keith @dwk.io

/* THANKS */
\tThanks to the Astro team for creating such a great static site generator.
\tThanks to the contributors of the projects I use on this site.
\tThanks to the contributors of the projects I have used in the past.
\tThanks to my family and friends for their support.

/* SITE */
Build Date: ${buildDate}
Generator: Astro
Package Version: 2.0.0
Commit Hash: ${getCommitHash()}`);
};

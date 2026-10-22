/**
 * Curriculum vitae content. Dates are ISO `YYYY-MM`; omit `end` for current roles.
 * Summaries, highlights, and patents may contain Markdown-style `[text](url)` links.
 */

/** Drops `[text](url)` link markup, keeping the text. */
export const stripLinks = (text: string) => text.replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1");

export interface Role {
  title: string;
  start: string;
  end?: string;
  location?: string;
  summary?: string;
  highlights?: string[];
}

export interface Job {
  org: string;
  url?: string;
  roles: Role[];
}

export interface School {
  name: string;
  url?: string;
  study?: string;
  start: string;
  end: string;
}

export interface CV {
  headline: string;
  location: string;
  summary: string;
  skills: string[];
  patents: string[];
  experience: Job[];
  education: School[];
}

export const cv: CV = {
  headline: "Software Engineer & Educator — Specification Literacy",
  location: "San Francisco Bay Area",
  summary:
    "Engineer, engineering manager, and developer educator with 30 years in industry, from Apple Developer Publications to leading a 50-person engineering and technical writing org at Nest (Google). I build Specification Literacy: teaching people to state what they want precisely enough that another person — or an AI — can build it without guessing. I practice it daily (a 30-plus-package open-standards monorepo written spec-first with Claude Code, conformance tests as the release bar), teach it in high school CS through TEALS, and am writing it up as [Specification Literacy](https://github.com/davidwkeith/specification-literacy/blob/main/index.md), a K–12+ framework whose first pilot is a [course for working professionals](https://github.com/davidwkeith/specification-literacy/blob/main/docs/de-anza-course-outline.md) at De Anza College.",
  skills: [
    "Specification writing",
    "Curriculum design",
    "Developer education & documentation",
    "API & protocol design",
    "Agentic AI development (Claude Code, Codex)",
    "Engineering management",
    "Open web standards (IndieWeb, ActivityPub, Solid)",
    "TypeScript",
    "Cloudflare Workers",
  ],
  patents: [
    "[Systems and methods of determining a type and feature set of a light source, and the control thereof](https://patents.google.com/patent/US9894735)",
    "[Rule-based rate limiting](https://patents.google.com/patent/US9660948)",
    "[Selectively restricting communications from third party applications/devices to electronic devices](https://patents.google.com/patent/US10084783)",
  ],
  experience: [
    {
      org: "Self-employed",
      roles: [
        {
          title: "Independent Software Engineer",
          start: "2021-11",
          location: "Santa Clara, California",
          summary:
            "Spec-first agentic engineering with Claude Code, Codex, and LM Studio: requirements and research are written with the AI before any code is generated, and human review plus conformance tests are the quality gate.",
          highlights: [
            "Wrote and built [@dwk/workers](https://github.com/davidwkeith/workers), 30+ TypeScript packages implementing open web standards (IndieAuth, Micropub, Webmention, ActivityPub, Solid, AT Protocol). Each package is generated from its own [written spec](https://github.com/davidwkeith/workers/tree/main/spec), and none can ship a stable release until it passes its standard's conformance suite",
            "Runs the whole stack on this site: [dwk.io](https://dwk.io) is a working personal server for the open social web",
            "Created [Anglesite](https://anglesite.dwk.io), an open source Claude Code and Claude Cowork plugin that acts as webmaster for small organizations, candidates, and local governments",
          ],
        },
      ],
    },
    {
      org: "TEALS (Microsoft Philanthropies)",
      url: "https://www.microsoft.com/en-us/teals",
      roles: [
        {
          title: "Volunteer Computer Science Teacher",
          start: "2018-08",
          location: "Thomas Jefferson High School, Los Angeles, California",
          summary: "Co-teaches high school computer science, applying specification-first problem solving in the classroom.",
        },
      ],
    },
    {
      org: "Silicon Valley Bicycle Coalition",
      url: "https://bikesiliconvalley.org",
      roles: [
        {
          title: "Information Technology Consultant",
          start: "2021-11",
          location: "San Jose, California",
          summary:
            "Applied agentic engineering to reduce the organization's SaaS footprint and build custom tooling on free or low-cost infrastructure:",
          highlights: [
            "Built [lanes.bikesiliconvalley.org](https://lanes.bikesiliconvalley.org), a GIS-powered tool tracking bike lanes by class across two counties, presenting complex open data as readable tables for advocacy use",
            "Replaced a paid event calendar SaaS product with a [custom-built equivalent](https://events.bikesiliconvalley.org/widget) running on Cloudflare's free tier",
            "Built a Gemini-powered Help Desk agent with knowledge of SVBC's SaaS stack, enabling staff to self-serve technical support previously handled by volunteer time",
          ],
        },
      ],
    },
    {
      org: "Shiloh Ballard for Santa Clara Valley Water District, 2024",
      url: "https://www.shilohballard.com",
      roles: [
        {
          title: "Information Technology Consultant",
          start: "2024-04",
          end: "2024-11",
          location: "San Jose, California",
          summary: "Website and Google Workspace support for a successful board campaign.",
        },
      ],
    },
    {
      org: "TARA.AI",
      url: "https://tara.ai",
      roles: [
        {
          title: "Lead Engineer",
          start: "2019-04",
          end: "2020-07",
          location: "San Jose, CA",
          highlights: [
            "Developed 18-month product roadmap and facilitated company vision refinement",
            "Scaled engineering team from 2 to 15 engineers; mentored junior engineers through rapid growth",
            "Led migration to GCP Firebase + App Engine, TypeScript, and functional React",
          ],
        },
      ],
    },
    {
      org: "DevSweet",
      url: "https://web.archive.org/web/20180808081948/http://devsweet.com/",
      roles: [
        {
          title: "Co-Founder & CEO",
          start: "2017-07",
          end: "2018-11",
          location: "Santa Clara, CA",
          summary:
            "Applied machine learning and NLP to software project management tooling. Conducted market research leading to a strategic decision to prioritize product-market fit over early funding.",
        },
      ],
    },
    {
      org: "Google",
      url: "https://about.google",
      roles: [
        {
          title: "Senior Engineering Manager — eCommerce & Works with Nest",
          start: "2013-12",
          end: "2017-06",
          location: "Palo Alto, CA",
          summary:
            "Managed a team of 50 engineers and writers across Nest's web app, online store, marketing site, B2B portals, and developer programs. Co-designed the [Works with Nest API](https://web.archive.org/web/20160708075828/https://developers.nest.com/), a behavior-driven specification for IoT device interoperability and a precursor of [Matter](https://csa-iot.org/all-solutions/matter/), the open home automation standard. Owned all developer curriculum and documentation for the program.",
          highlights: [
            "Built and managed the technical writing team responsible for educating hundreds of third-party engineers on a novel device-first home automation paradigm",
            "Rebuilt the docs from an API reference into a conceptual framework once support data showed developers needed the why, not just the what; iterated each release on that feedback",
            "Support questions about HVAC control, error responses, and rate limiting fell with each documentation release, and third-party integration bugs declined once simulators replaced physical test hardware",
            "Program scaled to hundreds of third-party developers",
            "Secured two patents related to the Works with Nest platform",
          ],
        },
      ],
    },
    {
      org: "Nest Labs",
      url: "https://web.archive.org/web/20131201155827/https://nest.com/",
      roles: [
        {
          title: "UX Engineer — eCommerce",
          start: "2011-11",
          end: "2013-12",
          location: "Palo Alto, CA",
          summary:
            "Created various tools, including Support Admin and Troubleshooting Widget using SproutCore and Ember.js, respectively. Also developed the [Nest Marketing Site](https://web.archive.org/web/20131201155827/https://nest.com/) using Middleman and [Nest Community Boards](https://web.archive.org/web/20140923115450/https://community.nest.com/) with Jive. Contributed to the development of Energy Partners Signup and [Nest Online Store](https://web.archive.org/web/20130106193411/http://store.nest.com/) utilizing Ember.js and Hybris.",
        },
      ],
    },
    {
      org: "Apple Inc.",
      url: "https://www.apple.com",
      roles: [
        {
          title: "UX Engineer — iCloud Calendar",
          start: "2011-09",
          end: "2011-11",
          location: "Cupertino, CA",
          summary: "Improved [iCloud Calendar](https://www.icloud.com/calendar/)'s CSS Sprites, timezone calculations, and localization through work with SproutCore.",
        },
        {
          title: "UX Engineer — Developer Publications",
          start: "2008-10",
          end: "2011-09",
          location: "Cupertino, CA",
          summary: "Individual contributor owning developer-facing documentation tooling for Xcode and the Apple Developer Portal.",
          highlights: [
            "Built documentation for the iPhone and iPad SDK, preparing thousands of third-party developers for new platform launches",
            "Pioneered inline contextual help for unfamiliar terms within developer documentation",
            "Created an HTML5-based iPad DocSet viewer and migrated the build system to Ruby",
            "Brought documentation advances from iPhone OS to macOS, improving consistency across the developer education ecosystem",
          ],
        },
        {
          title: "User Interface Analyst — Customer Systems",
          start: "2006-06",
          end: "2008-10",
          location: "Cupertino, CA",
          summary:
            "Led contract engineering team to streamline the Genius Bar repair workflow in PeopleSoft, saving five minutes per repair and scaling to support iPhone launch across hundreds of stores by providing inline documentation at the point of use to retail staff.",
        },
      ],
    },
    {
      org: "IGG Software",
      url: "https://www.iggsoftware.com",
      roles: [
        {
          title: "UX Engineer — iBank",
          start: "2007-07",
          end: "2008-10",
          summary:
            "Developed a web application that syncs with the desktop client to manage personal finances, which was shipped with iBank 3 and built on the security of MobileMe's iDisk. Developed this application prior to the introduction of the iOS App Store and IGG Software's native application.",
        },
      ],
    },
    {
      org: "Earlier career",
      roles: [
        {
          title: "Retail management, web development, and ISP support",
          start: "1996-06",
          end: "2006-06",
          summary:
            "Apple Genius and Apple Store assistant manager (mentored new Geniuses in troubleshooting); Ultimate Electronics assistant manager; freelance web developer; SysOp for the [Kingdom Connection](https://web.archive.org/web/19970107023506/http://www.kingcon.com/) dial-up ISP in Vermont.",
        },
      ],
    },
  ],
  education: [
    { name: "Cornell College", url: "https://cornellcollege.edu/", study: "Computer Science and Technical Theatre", start: "1997", end: "1999" },
    { name: "Unschooled", study: "GED, High School Equivalence Certificate Program", start: "1996", end: "1997" },
    { name: "Community College of Vermont", study: "Thinking & Writing", start: "1996", end: "1996" },
    { name: "St. Johnsbury Academy", url: "https://stjacademy.org", start: "1993", end: "1996" },
  ],
};

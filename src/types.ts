/**
 * Shared type definitions for the dwk.io Eleventy site.
 */

export interface NavItem {
  text: string;
  url: string;
}

export interface SiteData {
  title: string;
  description: string;
  url: URL;
  fediverseCreator: string;
  copyright: string;
  favicon: { src: string; appleIconBgColor: string; appleIconPadding: number };
  rating: string;
  language: string;
  hasNavigation: boolean;
  colorScheme: { content: string; media?: string };
  headLinks: Array<Record<string, string>>;
  defaultOgImage: string;
  manifest: { appName: string; appDescription: string; lang: string };
  logo: { src: string; alt: string };
  social: Record<string, string>;
}

export interface SchemaData {
  "@context": string;
  "@type": string;
  description: string;
  author?: {
    "@type": string;
    name: string;
    url: string;
    image: string;
    email: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface ProjectData {
  title: string;
  date: Date;
  permalink: string;
  hero?: { src: string; alt: string };
  banner?: { src: string };
  schema: Record<string, unknown>;
  summary?: string;
  description?: string;
  tags?: string[];
  attachments?: unknown[];
  content?: string;
  fileSlug: string;
  [key: string]: unknown;
}

export interface CollectionItem {
  url: string;
  date: Date;
  page: { url: string };
  data: ProjectData;
  templateContent?: string;
}

export interface EleventyData {
  site: SiteData;
  schema: SchemaData;
  navigation: NavItem[];
  collections: Record<string, CollectionItem[]>;
  [key: string]: unknown;
}

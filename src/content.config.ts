import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default(['project']),
    hero: z.object({
      src: z.string(),
      alt: z.string(),
      title: z.string().optional(),
      caption: z.string().optional(),
    }).optional(),
    schema: z.record(z.any()),
  }),
});

export const collections = { projects };

/**
 * Ambient type declarations for packages without bundled types.
 */

declare module "@11ty/eleventy" {
  export default class Eleventy {}
}

declare module "@11ty/eleventy/src/UserConfig" {
  interface UserConfig {
    setFreezeReservedData(freeze: boolean): void;
    addBundle(name: string): void;
    addPlugin(plugin: unknown, options?: unknown): void;
    addShortcode(name: string, fn: (...args: string[]) => string | Promise<string>): void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addFilter(name: string, fn: (...args: any[]) => unknown): void;
    addJavaScriptFunction(name: string, fn: (...args: unknown[]) => unknown): void;
    addTransform(
      name: string,
      fn: (this: { page: { outputPath: string } }, content: string) => string | Promise<string>,
    ): void;
    addExtension(name: string, options: { key: string }): void;
    addDataExtension(
      extensionList: string,
      options: {
        parser: (contentOrPath: string, filePath: string) => unknown | Promise<unknown>;
        read?: boolean;
      },
    ): void;
    addTemplateFormats(formats: string | string[]): void;
    setLibrary(name: string, lib: unknown): void;
    getFilter(name: string): (...args: unknown[]) => unknown;
  }
  export default UserConfig;
}

declare module "@11ty/eleventy-plugin-webc" {
  const plugin: unknown;
  export default plugin;
}

declare module "@11ty/eleventy-img" {
  interface ImageMetadata {
    [format: string]: Array<{ url: string; width: number; height: number }>;
  }

  interface ImageOptions {
    widths?: number[];
    formats?: string[];
    outputDir?: string;
    urlPath?: string;
    defaultAttributes?: Record<string, string>;
    filenameFormat?: (id: string, src: string, width: number, format: string, options: unknown) => string;
  }

  function Image(src: string, options?: ImageOptions): Promise<ImageMetadata>;

  namespace Image {
    function generateHTML(metadata: ImageMetadata, attributes: Record<string, unknown>): string;
  }

  export default Image;

  export function eleventyImagePlugin(eleventyConfig: unknown, options?: ImageOptions): void;
}

declare module "eleventy-plugin-gen-favicons" {
  const plugin: unknown;
  export default plugin;
}

declare module "jsonld-lint" {
  interface LintError {
    path: string;
    message: string;
    line: number;
    column: number;
  }
  export function lint(json: string): Promise<LintError[]>;
}

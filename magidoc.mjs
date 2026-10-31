/**
 * Magidoc configuration for CX Services GraphQL API documentation.
 *
 * Generates static documentation from the introspection SDL produced by
 * `scripts/gen-graphql-sdl.ts` (`.tmp/schema.graphql`).
 *
 * @see https://magidoc.js.org/cli/magidoc-configuration
 */

/** @type {import('@magidoc/cli').MagidocConfig} */
const config = {
  introspection: {
    type: 'sdl',
    paths: ['./.tmp/schema.graphql'],
  },
  website: {
    template: 'carbon-multi-page',
    title: 'CX Services GraphQL API',
    description: 'API reference for CX Services GraphQL schema',
    version: '1.0.0',
    contact: {
      name: 'CX Services',
    },
    logo: {
      light: '/logo-light.svg',
      dark: '/logo-dark.svg',
    },
    // Server(s) shown in the "Try it" panel / server selector.
    servers: [
      {
        url: 'https://your-domain.com/graphql',
        description: 'Production',
        headers: [
          {
            name: 'Authorization',
            example: 'Bearer <token>',
            comment: 'Add your JWT token here',
          },
        ],
      },
    ],
    // Fuzzy-search + SEO-friendly static site.
    search: true,
    // Allow markdown in schema descriptions.
    markdown: true,
    // Custom scalar value factories for the "Try it" panel query generator.
    options: {
      queryGenerationFactories: {
        Money: '100000',
        Timestamp: '1700000000000',
        DateTime: '2026-01-01T00:00:00.000Z',
        DateTimeOrTimestamp: '2026-01-01T00:00:00.000Z',
      },
    },
  },
  // Live hot-reload preview while developing docs.
  dev: {
    port: 3001,
  },
};

export default config;
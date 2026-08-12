# Image Generator

Canvas-based image generator for creating flow-field featured images from article metadata. Lives in two locations:

- `scripts/image-generator/` — standalone CLI tool (`tsx scripts/image-generator/src/cli.ts`)
- `src/HelloWorld/Client/src/imageGenerator/` — backoffice integration module

Uses `@napi-rs/canvas` for server-side rendering. Run via `npm run generate:images`. Unit tests via `npm run test:unit`.

Use the `/cms-image` command to generate and publish images.

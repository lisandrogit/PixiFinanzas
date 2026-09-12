// Workers entrypoint (Workers Builds runs `npx wrangler deploy`, which reads
// `main` from wrangler.toml — this is not the Pages Functions file-routing
// convention `functions/api/[[route]].ts` used, which only applies to
// classic Cloudflare Pages projects).
export { default } from '../functions/_lib/app';

import { source } from "@/lib/source";
import { createFromSource } from "fumadocs-core/search/server";

// `staticGET` exports the whole index as a static file so the route survives
// `output: 'export'` (GitHub Pages). The client uses the matching static search mode.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(source);

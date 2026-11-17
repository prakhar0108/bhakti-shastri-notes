import { source } from "@/lib/source";
import { isPrivatePath } from "@/lib/private";
import { createFromSource } from "fumadocs-core/search/server";

// Keep private (phrase-locked) pages out of the public search index.
const publicSource: typeof source = Object.assign(Object.create(source), {
  getPages: (...args: Parameters<typeof source.getPages>) =>
    source.getPages(...args).filter((page) => !isPrivatePath(page.url)),
});

// `staticGET` exports the whole index as a static file so the route survives
// `output: 'export'` (GitHub Pages). The client uses the matching static search mode.
export const revalidate = false;

export const { staticGET: GET } = createFromSource(publicSource);

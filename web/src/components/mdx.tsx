import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Mermaid } from "@/components/mdx/mermaid";
import { Shloka } from "@/components/mdx/shloka";
import { BookGrid, BookCard, BookCover } from "@/components/mdx/book-card";
import { LectureMeta } from "@/components/mdx/lecture-meta";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Mermaid,
    Shloka,
    BookGrid,
    BookCard,
    BookCover,
    LectureMeta,
    ...components,
  } satisfies MDXComponents;
}

import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Mermaid } from "@/components/mdx/mermaid";
import { Shloka } from "@/components/mdx/shloka";
import { BookGrid, BookCard, BookCover } from "@/components/mdx/book-card";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Mermaid,
    Shloka,
    BookGrid,
    BookCard,
    BookCover,
    ...components,
  } satisfies MDXComponents;
}

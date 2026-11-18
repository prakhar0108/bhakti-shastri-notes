import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import { Mermaid } from "@/components/mdx/mermaid";
import { Shloka } from "@/components/mdx/shloka";
import { VedabaseVerse } from "@/components/mdx/vedabase-verse";
import { BookGrid, BookCard, BookCover } from "@/components/mdx/book-card";
import { LectureMeta } from "@/components/mdx/lecture-meta";
import {
  ExamQuestions,
  ExamQuestion,
  ExamVerse,
} from "@/components/mdx/exam-qa";

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Mermaid,
    Shloka,
    VedabaseVerse,
    BookGrid,
    BookCard,
    BookCover,
    LectureMeta,
    ExamQuestions,
    ExamQuestion,
    ExamVerse,
    ...components,
  } satisfies MDXComponents;
}

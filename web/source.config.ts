import { remarkMdxMermaid } from 'fumadocs-core/mdx-plugins';
import { defineConfig } from 'fumadocs-mdx/config';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Global MDX preset used by every `doc` collection (see src/lib/source.ts).
// - remarkMdxMermaid turns ```mermaid code fences into <Mermaid chart="..." /> components.
// - remark-math + rehype-katex render the $$...$$ blocks used in some notes.
export default defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkMdxMermaid, remarkMath],
    rehypePlugins: [rehypeKatex],
  },
});

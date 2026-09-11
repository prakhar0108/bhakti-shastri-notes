'use client';

import { use, useEffect, useId, useState } from 'react';
import { useTheme } from 'next-themes';

export function Mermaid({ chart }: { chart: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Mermaid needs a real DOM + resolved theme, so it can only render on the client.
  if (!mounted) return null;
  return <MermaidContent chart={chart} />;
}

const cache = new Map<string, Promise<unknown>>();

function cachePromise<T>(key: string, setPromise: () => Promise<T>): Promise<T> {
  const cached = cache.get(key);
  if (cached) return cached as Promise<T>;

  const promise = setPromise();
  cache.set(key, promise);
  return promise;
}

function MermaidContent({ chart }: { chart: string }) {
  const id = useId();
  const { resolvedTheme } = useTheme();
  const { default: mermaid } = use(cachePromise('mermaid', () => import('mermaid')));
  const isDark = resolvedTheme === 'dark';

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    fontFamily: 'inherit',
    themeCSS: 'margin: 1.5rem auto 0;',
    theme: 'base',
    themeVariables: isDark
      ? {
          background: '#14121c',
          primaryColor: '#3a2c1a',
          primaryTextColor: '#ede6d8',
          primaryBorderColor: '#f0a860',
          secondaryColor: '#1b2f31',
          secondaryTextColor: '#ede6d8',
          secondaryBorderColor: '#5cc2ba',
          lineColor: '#d9a94a',
          tertiaryColor: '#1b1826',
          nodeTextColor: '#ede6d8',
        }
      : {
          background: '#fbf7ef',
          primaryColor: '#f6ddb8',
          primaryTextColor: '#2a2320',
          primaryBorderColor: '#c2410c',
          secondaryColor: '#dcefee',
          secondaryTextColor: '#2a2320',
          secondaryBorderColor: '#1f6f78',
          lineColor: '#b8860b',
          tertiaryColor: '#fffbf2',
          nodeTextColor: '#2a2320',
        },
  });

  const { svg, bindFunctions } = use(
    cachePromise(`${chart}-${resolvedTheme}`, () => {
      return mermaid.render(id, chart.replaceAll('\\n', '\n'));
    }),
  );

  return (
    <div
      ref={(container) => {
        if (container) bindFunctions?.(container);
      }}
      // eslint-disable-next-line @typescript-eslint/naming-convention
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

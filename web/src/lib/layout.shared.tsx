import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BrandMark } from "@/components/brand-mark";
import { appName } from "@/lib/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <BrandMark className="size-5" />
          <span className="font-heading text-base font-semibold tracking-wide">
            {appName}
          </span>
        </>
      ),
    },
  };
}

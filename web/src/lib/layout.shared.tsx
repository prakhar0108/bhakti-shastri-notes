import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import Image from "next/image";
import { PrabhupadaAvatar } from "@/components/prabhupada-avatar";
import { appName } from "@/lib/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2.5">
          {/* Artwork is white-on-transparent; a dark chip keeps it visible in both themes. */}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-neutral-900 p-1">
            <Image
              src="/isk-gkp-logo.png"
              alt="ISKCON Gorakhpur"
              title="ISKCON Gorakhpur"
              width={72}
              height={58}
              priority
              className="size-full object-contain"
            />
          </span>
          <span className="font-heading text-base font-semibold tracking-wide">
            {appName}
          </span>
        </div>
      ),
      children: (
        <div className="flex flex-1 items-center justify-end md:hidden">
          <PrabhupadaAvatar className="block size-12" />
        </div>
      ),
    },
  };
}

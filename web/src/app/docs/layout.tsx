import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { SidebarBanner, SidebarFooter } from "@/components/sidebar-extras";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      sidebar={{ banner: <SidebarBanner />, footer: <SidebarFooter /> }}
      {...baseOptions()}
    >
      {children}
    </DocsLayout>
  );
}

import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { baseOptions } from "@/lib/layout.shared";
import { PrabhupadaAvatarCorner } from "@/components/prabhupada-avatar";
import { AdminButtonCorner } from "@/components/admin-button";
import { SidebarFooter } from "@/components/sidebar-extras";
import { PrivateUnlockSync } from "@/components/private-gate";

export default function Layout({ children }: LayoutProps<"/docs">) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      sidebar={{ footer: <SidebarFooter /> }}
      {...baseOptions()}
    >
      <PrabhupadaAvatarCorner />
      <AdminButtonCorner />
      <PrivateUnlockSync />
      {children}
    </DocsLayout>
  );
}

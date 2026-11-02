import { Navigation } from "@/components/navigation";
import { requireViewer } from "@/server/auth";
export const dynamic = "force-dynamic";
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  return <div className="platform-layout"><Navigation viewer={viewer} /><main id="main-content" className="platform-main">{children}</main></div>;
}

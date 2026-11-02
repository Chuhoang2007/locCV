import { redirect } from "next/navigation";
import { getViewer } from "@/server/auth";
import { modeHome } from "@/domain/profile";
export const dynamic = "force-dynamic";
export default async function Home() {
  const viewer = await getViewer();
  redirect(viewer ? modeHome(viewer.profile.preferred_mode) : "/login");
}

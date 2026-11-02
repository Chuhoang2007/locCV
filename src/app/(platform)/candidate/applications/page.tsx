import { requireViewer } from "@/server/auth";
import { listApplications } from "@/server/dal/applications";
import { ApplicationList } from "@/components/application-list";
export const metadata = { title: "Hồ sơ ứng tuyển" };
export default async function CandidateHome({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
  const viewer=await requireViewer();const params=await searchParams;const result=await listApplications(viewer.id,params);
  return <div><header className="page-heading"><h1>Hồ sơ ứng tuyển</h1><p>Theo dõi CV, điều kiện làm bài và phản hồi từ nhà tuyển dụng.</p></header><ApplicationList items={result.items} nextCursor={result.next_cursor} base="/candidate/applications" timezone={viewer.profile.timezone} status={params.status}/></div>;
}

import { requireViewer } from "@/server/auth";
import { listInbox } from "@/server/dal/messages";
import { InboxList } from "@/components/inbox-list";
export const metadata={title:"Hộp thư"};
export default async function Inbox({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){const viewer=await requireViewer();const params=await searchParams;const unread=params.unread==="true";const data=await listInbox(viewer.id,{unread:String(unread)});return <div className="inbox-page"><header className="page-heading"><h1>Hộp thư</h1><p>Tiến trình hồ sơ và những phản hồi dành cho bạn.</p></header><InboxList key={String(unread)} initial={data} unread={unread} timeZone={viewer.profile.timezone}/></div>;}

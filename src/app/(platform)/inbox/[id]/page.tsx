import { notFound } from "next/navigation";
import { requireViewer } from "@/server/auth";
import { getMessage } from "@/server/dal/messages";
import { MessageDetail } from "@/components/message-detail";
import { AppError } from "@/lib/errors";
export const metadata={title:"Chi tiết thông báo"};
export default async function Message({params}:{params:Promise<{id:string}>}){const viewer=await requireViewer();const data=await getMessage(viewer.id,(await params).id).catch(e=>{if(e instanceof AppError&&[400,404].includes(e.status))notFound();throw e;});return <MessageDetail initial={data} timeZone={viewer.profile.timezone}/>;}

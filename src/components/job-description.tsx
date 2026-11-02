import type { EditableDraft } from "@/domain/jobs";
export function salaryLabel(min:number|null,max:number|null){
  const number=(n:number)=>new Intl.NumberFormat("vi-VN").format(n);
  if(min==null&&max==null)return "Lương thỏa thuận";
  return `${min!=null?number(min):"Đến"}${min!=null&&max!=null?" – ":" "}${max!=null?number(max):"trở lên"} ₫/tháng`;
}
export function JobDescription({jd}:{jd:EditableDraft["jd"]}){
  return <div className="job-description"><p className="job-summary-text">{jd.summary||"Chưa có tóm tắt công việc."}</p>{([
    ["Trách nhiệm",jd.responsibilities],["Yêu cầu",jd.requirements],["Quyền lợi",jd.benefits],
  ] as const).map(([title,items])=><section key={title}><h2>{title}</h2><ul>{items.filter(t=>t.trim()).map((text,i)=><li key={i}>{text}</li>)}</ul></section>)}</div>;
}

export function JobStatus({status}:{status:"DRAFT"|"PUBLISHED"|"CLOSED"}){
  return <span className={`status-badge status-${status.toLowerCase()}`}>{({DRAFT:"Bản nháp",PUBLISHED:"Đang tuyển",CLOSED:"Đã đóng"})[status]}</span>;
}

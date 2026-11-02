import type { ZodIssue } from "zod";
import type { EditableDraft } from "./jobs";
export type ValidationFeedback={path:(string|number)[];message:string};
export function validationFeedback(issues:readonly ZodIssue[]):ValidationFeedback[]{
  return issues.slice(0,100).map(issue=>{
    let message="Vui lòng kiểm tra nội dung của trường này.";
    if(issue.code==="custom")message=issue.message;
    if(issue.code==="too_small")message=issue.origin==="number"?`Giá trị tối thiểu là ${issue.minimum}.`:issue.origin==="array"?`Cần ít nhất ${issue.minimum} mục.`:issue.minimum===1?"Vui lòng nhập nội dung.":`Cần ít nhất ${issue.minimum} ký tự.`;
    if(issue.code==="too_big")message=issue.origin==="number"?`Giá trị tối đa là ${issue.maximum}.`:issue.origin==="array"?`Chỉ được có tối đa ${issue.maximum} mục.`:`Nội dung tối đa ${issue.maximum} ký tự.`;
    if(issue.code==="invalid_type")message=issue.expected==="number"?"Vui lòng nhập số hợp lệ.":"Thông tin này chưa đúng định dạng.";
    return {path:issue.path.filter((p):p is string|number=>typeof p==="string"||typeof p==="number"),message};
  });
}
export function validationTarget(path:(string|number)[],draft:EditableDraft):{tab:number;id:string}{
  if(path[0]==="draft")return validationTarget(path.slice(1),draft);
  if(path[0]==="jd")return {tab:0,id:({title:"job-title",summary:"job-summary",location:"job-location",skills:"job-skills",salary_min:"salary-min",salary_max:"salary-max"} as Record<string,string>)[String(path[1])]??`job-${path[1]??"title"}`};
  if(path[0]==="interview_access_policy")return {tab:1,id:"access-policy"};
  if(path[0]==="scoring_rubric"){
    if(path[1]==="pass_threshold")return {tab:1,id:"pass-threshold"};
    const c=draft.scoring_rubric.criteria[Number(path[2])];
    return {tab:1,id:c?`${c.id}-${path[3]==="scoring_guidance"?"guide":path[3]==="max_points"?"points":"label"}`:"rubric-criteria"};
  }
  if(path[0]==="interview_questions"){
    if(path[1]==="duration_minutes")return {tab:2,id:"duration"};
    const section=path[1]==="essay"?"essay":"quiz",q=draft.interview_questions[section][Number(path[2])];
    if(!q)return {tab:2,id:`${section}-heading`};
    if(section==="quiz"&&path[3]==="options"){
      const item=draft.interview_questions.quiz[Number(path[2])]?.options[Number(path[4])];
      if(item)return {tab:2,id:`${q.id}-${item.id}`};
    }
    if(section==="essay"&&path[3]==="rubric"){
      const item=draft.interview_questions.essay[Number(path[2])]?.rubric[Number(path[4])];
      if(item)return {tab:2,id:`${q.id}-${item.id}-${path[5]==="max_points"?"points":path[5]==="scoring_guidance"?"guide":"description"}`};
    }
    return {tab:2,id:`${q.id}-${path[3]==="correct_answer"?"answer":path[3]==="max_points"?"points":"prompt"}`};
  }
  return {tab:0,id:"job-title"};
}

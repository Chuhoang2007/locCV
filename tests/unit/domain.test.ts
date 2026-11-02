import { describe, expect, it } from "vitest";
import { canApply, canTransition } from "@/domain/application-state";
import { loginSchema, signupSchema, resetPasswordSchema, safeNextPath } from "@/domain/auth";
import { profileUpdateSchema } from "@/domain/profile";
import { toCandidateQuestionDTO, toPublicJobDTO } from "@/server/dto-mappers";

describe("Danh tính, quyền và input", () => {
  it("đổi mode không làm mất ràng buộc self-apply", () => {
    expect(canApply("same-id","same-id")).toBe(false);
    expect(canApply("owner","candidate")).toBe(true);
  });
  it("chỉ cho chuyển đúng state machine", () => {
    expect(canTransition("CV_SUBMITTED","CV_PASSED")).toBe(true);
    expect(canTransition("CV_FAILED","INTERVIEW_IN_PROGRESS")).toBe(false);
    expect(canTransition("CV_FAILED","INTERVIEW_IN_PROGRESS","ALWAYS")).toBe(true);
    expect(canTransition("CV_FAILED","HR_APPROVED")).toBe(false);
    expect(canTransition("HR_APPROVED","HR_REJECTED")).toBe(false);
    expect(canTransition("EVALUATED","HR_REJECTED")).toBe(true);
  });
  it("không nhận actor, role, điểm hoặc id từ PATCH hồ sơ", () => {
    for (const body of [{id:"other"},{role:"admin"},{cv_score:100},{preferred_mode:"ADMIN"},{}]) {
      expect(profileUpdateSchema.safeParse(body).success).toBe(false);
    }
    expect(profileUpdateSchema.parse({preferred_mode:"HR"})).toEqual({preferred_mode:"HR"});
  });
  it("từ chối tên trắng, timezone giả và password yếu", () => {
    expect(profileUpdateSchema.safeParse({display_name:"   "}).success).toBe(false);
    expect(profileUpdateSchema.safeParse({timezone:"Invalid/Zone"}).success).toBe(false);
    expect(signupSchema.safeParse({display_name:"A",email:"a@example.test",password:"short"}).success).toBe(false);
    expect(resetPasswordSchema.safeParse({password:"long-enough-password",confirm_password:"different"}).success).toBe(false);
    expect(loginSchema.safeParse({email:"invalid",password:"abc"}).success).toBe(false);
  });
  it("chống open redirect và redirect injection", () => {
    for (const path of ["https://evil.test","//evil.test","/\\evil.test","/settings?next=evil","/auth/callback","/api/me","/%2f%2fevil.test"]) expect(safeNextPath(path)).toBe("/settings");
    expect(safeNextPath("/candidate/applications")).toBe("/candidate/applications");
    expect(safeNextPath("/hr")).toBe("/hr");
  });
});

describe("DTO allowlist", () => {
  it("bỏ đáp án và rubric kể cả khi dữ liệu nguồn có các khóa riêng", () => {
    const result = toCandidateQuestionDTO({
      raw_hr_prompt:"secret", quiz:[{id:"q",prompt:"Câu hỏi",correct_answer:"a",options:[{id:"a",text:"A",is_correct:true}]}],
      essay:[{id:"e",prompt:"Tình huống",rubric:[{answer:"secret"}]}],
    });
    expect(JSON.stringify(result)).not.toMatch(/secret|correct_answer|rubric|is_correct/);
    expect(result.quiz[0].options).toEqual([{id:"a",text:"A"}]);
  });
  it("job DTO không serialize nguyên hàng database", () => {
    const result = toPublicJobDTO({id:"11111111-1111-4111-8111-111111111111",title:"Developer",location:null,skills:[],salary_min:null,salary_max:null,published_at:null,interview_questions_json:{correct_answer:"secret"},raw_hr_prompt:"private"});
    expect(Object.keys(result)).toHaveLength(7);
    expect(JSON.stringify(result)).not.toMatch(/secret|private|correct_answer/);
  });
});

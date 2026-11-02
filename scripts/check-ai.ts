import { existsSync } from "node:fs";
import { z } from "zod";
import { AIClientError,generateJobAndAssessment,evaluateCandidateCV,evaluateInterviewAnswers,gradeQuiz,buildInterviewEvaluation } from "../src/lib/ai-client.ts";
import { getAISettings } from "../src/lib/env.ts";
if(existsSync(".env.local"))process.loadEnvFile(".env.local");
try{
  const {model}=getAISettings();
  if(process.argv.includes("--essay")){
    const questions={schema_version:1 as const,duration_minutes:30,quiz_weight:40 as const,essay_weight:60 as const,
      quiz:[{id:"q_local",prompt:"Synthetic quiz",options:[{id:"a",text:"A"},{id:"b",text:"B"}],correct_answer:"a",max_points:10}],
      essay:[{id:"e_api",prompt:"Bạn xử lý dữ liệu JSON từ API bên ngoài như thế nào?",max_points:10,rubric:[{id:"validation",description:"Kiểm tra runtime",max_points:6,scoring_guidance:"0: không kiểm tra; 3: kiểm tra vài trường; 6: dùng schema trước xử lý."},{id:"errors",description:"Lỗi an toàn",max_points:4,scoring_guidance:"0: bỏ qua; 2: bắt lỗi; 4: bắt lỗi và không lộ dữ liệu riêng."}]}],
    };
    const answers={quiz:[{question_id:"q_local",selected_answer:"a"}],essay:[{question_id:"e_api",text:"Dữ liệu giả kiểm tra tích hợp: Tôi dùng schema kiểm tra dữ liệu runtime trước khi xử lý. Tôi bắt lỗi, che thông tin riêng và hiển thị thông báo an toàn cho người dùng."}]};
    const result=buildInterviewEvaluation(gradeQuiz(answers,questions),await evaluateInterviewAnswers(answers,questions),questions);
    console.log(JSON.stringify({ok:true,kind:"EVALUATE_ESSAY",model,questions:result.essay.questions.length,quiz_score:result.quiz.score,essay_score:result.essay.score,total_score:result.total_score,evidenceValidated:true}));
  }else if(process.argv.includes("--cv")){
    const result=await evaluateCandidateCV("SYNTHETIC CV for integration testing, not a real person. Developed TypeScript and React applications. Wrote unit tests and integration tests, documented SQL database changes and reviewed code with a product team.",{
      schema_version:1,pass_threshold:60,criteria:[{id:"typescript",label:"TypeScript",max_points:60,scoring_guidance:"0: no evidence; 30: mentions TypeScript; 60: describes building TypeScript applications."},{id:"testing",label:"Testing",max_points:40,scoring_guidance:"0: no evidence; 20: mentions testing; 40: describes writing unit and integration tests."}],
    });
    console.log(JSON.stringify({ok:true,kind:"EVALUATE_CV",model,criteria:result.criteria.length,score:result.total_score,passed:result.passed,evidenceValidated:true}));
  }else if(process.argv.includes("--generate")){
    const result=await generateJobAndAssessment("Tuyển Frontend Developer React TypeScript, kinh nghiệm kiểm thử. Địa điểm Hà Nội, lương 20–30 triệu VND/tháng. Dữ liệu giả để kiểm tra tích hợp, không phải tin đăng thật.");
    console.log(JSON.stringify({ok:true,model,criteria:result.scoring_rubric.criteria.length,total:result.scoring_rubric.criteria.reduce((n,c)=>n+c.max_points,0),quiz:result.interview_questions.quiz.length,essay:result.interview_questions.essay.length}));
  }else{
    const response=await fetch(`${process.env.NINE_ROUTER_BASE_URL!.replace(/\/+$/,"")}/models`,{headers:{Authorization:`Bearer ${process.env.NINE_ROUTER_API_KEY}`},redirect:"error",signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw new Error("MODEL_LIST_UNAVAILABLE");
    const result=z.object({data:z.array(z.object({id:z.string().max(200)})).max(5000)}).parse(await response.json());
    console.log(JSON.stringify({ok:true,configured_model:model,available:result.data.some(m=>m.id===model),models:result.data.slice(0,80).map(m=>m.id)}));
  }
}catch(error){console.error(JSON.stringify({ok:false,code:error instanceof AIClientError?error.code:"AI_CONFIGURATION_OR_MODEL_LIST_ERROR"}));process.exitCode=1;}

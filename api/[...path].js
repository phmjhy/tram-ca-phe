import { getApp } from '../server/runtime.js';
export default { async fetch(request) {
 if(new URL(request.url).pathname==='/api/v1/version')return Response.json({build:process.env.VERCEL_GIT_COMMIT_SHA||'local',apiVersion:1,configured:Boolean(process.env.DATABASE_URL&&process.env.BETTER_AUTH_SECRET)},{headers:{'Cache-Control':'no-store'}});
 try{return await getApp()(request);}catch{return Response.json({error:'Backend chưa được cấu hình. Cần cấu hình database và auth phía server.',code:'CONFIGURATION_REQUIRED'},{status:503,headers:{'Cache-Control':'no-store'}});}
}};

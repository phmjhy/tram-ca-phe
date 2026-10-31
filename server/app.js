import { randomUUID } from 'node:crypto';
import { services } from './service.js';
import { HttpError, fields, requireOwner } from './validation.js';
import { businessDate } from '../src/domain.js';
export function createApp({pool,auth,origin,build='development'}) {
 const service=services(pool);
 const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 return async function handle(request) {
  const requestId=randomUUID();
  try {
   const url=new URL(request.url);const path=url.pathname.replace(/\/$/,'');const method=request.method;
   if(path==='/api/v1/version')return json({build,apiVersion:1});
   if(!['GET','POST','PATCH'].includes(method))throw new HttpError(405,'Method không được hỗ trợ.');
   if(method!=='GET'&&(request.headers.get('origin')!==origin||!request.headers.get('content-type')?.startsWith('application/json')))throw new HttpError(403,'Origin hoặc kiểu nội dung không hợp lệ.');
   if(path.startsWith('/api/auth/')){
    if(!['/api/auth/sign-in/email','/api/auth/sign-out','/api/auth/get-session','/api/auth/change-password'].includes(path))throw new HttpError(403,'Endpoint tài khoản không được mở công khai.');
    return await auth.handler(request);
   }
   const session=await auth.api.getSession({headers:request.headers});
   if(!session)throw new HttpError(401,'Vui lòng đăng nhập.','UNAUTHENTICATED');
   const access=(await pool.query('SELECT role,active FROM user_access WHERE user_id=$1',[session.user.id])).rows[0];
   if(!access?.active)throw new HttpError(403,'Tài khoản chưa được cấp quyền hoặc đã bị khóa.');
   const actor={id:session.user.id,...access};
   if(path==='/api/v1/me'&&method==='GET')return json({id:actor.id,name:session.user.name,role:actor.role});
   if(method!=='GET'&&request.headers.get('x-tram-request')!=='1')throw new HttpError(403,'Thiếu xác thực request trình duyệt.');
   let body={};
   if(method!=='GET'){
    const raw=await request.text();if(Buffer.byteLength(raw)>65536)throw new HttpError(413,'Nội dung quá lớn.');
    try{body=JSON.parse(raw);}catch{throw new HttpError(422,'JSON không hợp lệ.');}
   }
   const from=url.searchParams.get('from')||businessDate(),to=url.searchParams.get('to')||from;
   if(path==='/api/v1/inventory'&&method==='GET')return json(await service.inventory(actor));
   if(path==='/api/v1/ingredients'&&method==='POST')return json(await service.ingredient(actor,body,request.headers.get('idempotency-key')),201);
   const ingredient=path.match(/^\/api\/v1\/ingredients\/([^/]+)$/);
   if(ingredient&&method==='PATCH')return json(await service.updateIngredient(actor,ingredient[1],body));
   if(path==='/api/v1/stock'&&method==='POST')return json(await service.stock(actor,body,request.headers.get('idempotency-key')),201);
   const recipe=path.match(/^\/api\/v1\/products\/([^/]+)\/recipe$/);
   if(recipe&&method==='PATCH')return json(await service.recipe(actor,recipe[1],body));
   const cancel=path.match(/^\/api\/v1\/orders\/([^/]+)\/cancel$/);
   if(cancel&&method==='POST')return json(await service.cancel(actor,cancel[1],body,request.headers.get('idempotency-key')));
   if(path==='/api/v1/shifts'){
    if(method==='GET')return json(await service.shifts(actor,from,to));
    if(method==='POST')return json(await service.shift(actor,body,request.headers.get('idempotency-key')),201);
   }
   const attendance=path.match(/^\/api\/v1\/shifts\/([^/]+)\/attendance$/);
   if(attendance&&method==='POST')return json(await service.attendance(actor,attendance[1],body,request.headers.get('idempotency-key')));
   const correction=path.match(/^\/api\/v1\/shifts\/([^/]+)$/);
   if(correction&&method==='PATCH')return json(await service.correctShift(actor,correction[1],body));
   if(path==='/api/v1/expenses'){
    if(method==='GET')return json(await service.expenses(actor,from,to));
    if(method==='POST')return json(await service.expense(actor,body,request.headers.get('idempotency-key')),201);
   }
   if(path==='/api/v1/dashboard'&&method==='GET')return json(await service.dashboard(actor,from,to));
   if(path==='/api/v1/products'){
    if(method==='GET')return json(await service.listProducts());
    if(method==='POST')return json(await service.addProduct(actor,body),201);
   }
   const product=path.match(/^\/api\/v1\/products\/([^/]+)$/);
   if(product&&method==='PATCH')return json(await service.updateProduct(actor,product[1],body));
   if(path==='/api/v1/orders'){
    if(method==='GET'){
     const limit=Number(url.searchParams.get('limit')||100);const before=url.searchParams.get('before');
     if(!Number.isInteger(limit)||limit<1||limit>100||(before&&!Number.isFinite(Date.parse(before))))throw new HttpError(422,'Phân trang không hợp lệ.');
     return json(await service.listOrders(actor,{limit,before}));
    }
    if(method==='POST')return json(await service.createOrder(actor,body,request.headers.get('idempotency-key')),201);
   }
   const payment=path.match(/^\/api\/v1\/orders\/([^/]+)\/payment$/);
   if(payment&&method==='POST'){
    fields(body,[]);
    return json(await service.pay(actor,payment[1],request.headers.get('idempotency-key')));
   }
   if(path==='/api/v1/reports/daily'&&method==='GET'){requireOwner(actor);return json(await service.dailyReport(url.searchParams.get('date')||businessDate()));}
   const operation=path.match(/^\/api\/v1\/operations\/([^/]+)$/);
   if(operation&&method==='GET')return json(await service.operation(actor,operation[1]));
   throw new HttpError(404,'API không tồn tại.');
  }catch(error){
   const status=error.status||(['23505'].includes(error.code)?409:['23514','22P02','23503','22003'].includes(error.code)?422:503);
   const message=error.status?error.message:error.code==='23505'?'Dữ liệu bị trùng hoặc đã có ca check-in. Tải lại để kiểm tra.':'Không thể xử lý yêu cầu. Dữ liệu chưa được xác nhận; vui lòng thử lại cùng thao tác.';
   // Log only a correlation ID and error class/code, never payloads/SQL/connection strings.
   if(status>=500)console.error(JSON.stringify({requestId,code:error.code||'BACKEND_UNAVAILABLE'}));
   return json({error:message,code:error.status?error.code:'BACKEND_UNAVAILABLE',requestId},status);
  }
 };
}

import {journaledRequest} from './mutation-journal.js';
let actor=null;
export function configureMutations(id){actor=id;}
export class ApiError extends Error { constructor(message,status,code){super(message);this.status=status;this.code=code;} }
export function request(path,options={}){
 return journaledRequest(path,options,send,{actor, get storage(){return sessionStorage;},changed:detail=>window.dispatchEvent(new CustomEvent('tram-pending-mutations',{detail}))});
}
async function send(path,{method='GET',body,key,signal}={}) {
 let response;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
 try { response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
  headers:{'Content-Type':'application/json','X-Tram-Request':'1',...(key?{'Idempotency-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})}); }
 catch {clearTimeout(timer);signal?.removeEventListener('abort',abort);throw new ApiError('Mất kết nối hoặc chưa xác định kết quả lưu. Giữ giỏ và thử lại cùng thao tác; không tạo đơn mới.',0,'NETWORK_ERROR');}
 let result;try{result=await response.json();}catch{throw new ApiError('Server trả dữ liệu không hợp lệ. Chưa xác nhận lưu.',response.status);}
 finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
 if(!response.ok)throw new ApiError(result.error||result.message||'Yêu cầu không thành công.',response.status,result.code);
 return result;
}

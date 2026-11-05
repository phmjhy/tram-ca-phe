const prefix='tram_pending_mutation:';
const paths=new Set(['/api/v1/products','/api/v1/ingredients','/api/v1/stock','/api/v1/expenses','/api/v1/shifts']);
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])):value;
export function pendingMutations(actor,storage){
 if(!actor||!storage)return [];
 const result=[];
 for(let i=0;i<storage.length;i++){const name=storage.key(i);if(name?.startsWith(prefix+actor+':')){try{const r=JSON.parse(storage.getItem(name));if(paths.has(r.path)&&r.method==='POST'&&r.key&&r.body)result.push(r);}catch{/* Preserve malformed data; fail closed on submit. */}}}
 return result;
}
export async function journaledRequest(path,options,send,context={}){
 const {actor,changed=()=>{}}=context;
 if(!actor||options.method!=='POST'||!paths.has(path))return send(path,options);
 const name=prefix+actor+':'+path;
 let record,storage;
 try {
  storage=context.storage;
  const raw=storage.getItem(name);record=raw?JSON.parse(raw):{path,method:'POST',key:options.key||crypto.randomUUID(),body:options.body};
  if(!record.key||record.path!==path||record.method!=='POST'||!record.body)throw new Error();
  if(JSON.stringify(stable(record.body))!==JSON.stringify(stable(options.body)))throw Object.assign(new Error('Còn thao tác chưa xác nhận. Bấm Thử lại thao tác chờ trước khi nhập nội dung mới.'),{status:409,code:'PENDING_OPERATION'});
  storage.setItem(name,JSON.stringify(record));changed({path,actor,status:'pending'});
 }catch(error){if(error.code==='PENDING_OPERATION')throw error;throw Object.assign(new Error('Không lưu được mã thử lại trên thiết bị. Chưa gửi thao tác.'),{status:0,code:'JOURNAL_UNAVAILABLE'});}
 try {const result=await send(path,{...options,key:record.key,body:record.body});storage.removeItem(name);changed({path,actor,status:'complete'});return result;}
 catch(error){
  // A network/5xx/auth error does not establish whether the write committed.
  if(error.status>=400&&error.status<500&&![401,403,429].includes(error.status)&&error.code!=='IDEMPOTENCY_CONFLICT'){storage.removeItem(name);changed({path,actor,status:'rejected'});}
  throw error;
 }
}

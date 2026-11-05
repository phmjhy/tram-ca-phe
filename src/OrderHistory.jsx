import React,{useEffect,useState,useRef} from 'react';
import {request} from './api-client.js';
const money=n=>Number(n).toLocaleString('vi-VN')+'đ';
const local=v=>new Date(v).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'});
export function OrderHistory({owner,disabled,operation}){
 const [day,setDay]=useState(''),[rows,setRows]=useState([]),[cursor,setCursor]=useState(null),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const epoch=useRef(0),paging=useRef(false),cursorRef=useRef(null);
 const query=`/api/v1/orders?limit=30${day?`&from=${day}&to=${day}`:''}`;
 useEffect(()=>{const n=++epoch.current,controller=new AbortController();setRows([]);setMore(false);setBusy(false);paging.current=false;cursorRef.current=null;setCursor(null);
  async function load(){try{const data=await request(query,{signal:controller.signal});if(n!==epoch.current)return;setRows(old=>[...new Map([...old,...data].map(r=>[r.id,r])).values()].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id)));if(!cursorRef.current){const c=data.at(-1)?.cursor;cursorRef.current=c;setCursor(c);setMore(data.length===30);}setError('');}catch(e){if(!controller.signal.aborted&&n===epoch.current)setError(e.message);}}
  load();const timer=setInterval(()=>{if(!document.hidden)load();},3000);return()=>{++epoch.current;controller.abort();clearInterval(timer);};
 },[query]);
 async function next(){if(paging.current||!cursor)return;paging.current=true;setBusy(true);const n=epoch.current;try{const data=await request(query+'&cursor='+encodeURIComponent(cursor));if(n!==epoch.current)return;setRows(old=>[...new Map([...old,...data].map(r=>[r.id,r])).values()]);const c=data.at(-1)?.cursor;cursorRef.current=c||cursorRef.current;setCursor(c||cursor);setMore(data.length===30);setError('');}catch(e){if(n===epoch.current)setError(e.message);}finally{if(n===epoch.current){paging.current=false;setBusy(false);}}}
 async function update(id,type,body){const n=epoch.current;if(await operation(id,type,body)){try{const row=await request('/api/v1/orders/'+id);if(n===epoch.current)setRows(old=>old.map(o=>o.id===id?row:o));}catch(e){if(n===epoch.current)setError(e.message);}}}

 return <section className="card recent"><h2>Giao dịch gần đây</h2><div className="form-row"><label>Ngày bán<input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label><button onClick={()=>setDay('')}>Tất cả ngày</button></div>{error&&<p role="alert">{error}</p>}{rows.map(o=><article className="recent-row" key={o.id}><div><strong>{o.items.map(i=>`${i.qty} ${i.name}`).join(', ')}</strong><small>{local(o.createdAt)} · {money(o.total)}</small>{o.items.some(i=>i.note)&&<small>{o.items.filter(i=>i.note).map(i=>`${i.name}: ${i.note}`).join(' · ')}</small>}<small>{o.cancelled?'Đã hủy · ':''}{o.paid?`Đã thanh toán · ${local(o.paidAt)}`:'Chưa thanh toán'}</small></div>{!o.cancelled&&<div className="row-actions">{!o.paid&&<button disabled={disabled} onClick={()=>update(o.id,'payment',{})}>Đã thanh toán</button>}{owner&&<button disabled={disabled} onClick={()=>{const reason=window.prompt('Lý do hủy (giao dịch đã thu cần đối soát tiền hoàn riêng)');if(reason?.trim())update(o.id,'cancel',{reason});}}>Hủy</button>}</div>}</article>)}{more&&<button disabled={busy} onClick={next}>{busy?'Đang tải…':'Xem thêm'}</button>}</section>;
}

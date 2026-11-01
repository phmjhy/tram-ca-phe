import React,{useState} from 'react';
import {request} from './api-client.js';
export function IngredientEditor({ingredient:i,act,disabled,load}){
 const [base,setBase]=useState(i),[name,setName]=useState(i.name),[minimum,setMinimum]=useState(i.minimum),[cost,setCost]=useState(i.unit_cost);
 const dirty=name!==base.name||String(minimum)!==String(base.minimum)||String(cost)!==String(base.unit_cost);
 const stale=i.version>base.version;
 function reload(){setBase(i);setName(i.name);setMinimum(i.minimum);setCost(i.unit_cost);}
 return <details><summary>Sửa nguyên liệu</summary><form onSubmit={async e=>{e.preventDefault();if(await act(()=>request(`/api/v1/ingredients/${i.id}`,{method:'PATCH',body:{name,minimum,unitCost:cost,version:base.version}}))){setBase({...base,name,minimum,unit_cost:cost,version:base.version+1});load();}}}>
 <label>Tên nguyên liệu<input name="name" required maxLength={120} value={name} onChange={e=>setName(e.target.value)}/></label>
 <label>Tồn tối thiểu<input name="minimum" required type="number" min="0" step="0.001" value={minimum} onChange={e=>setMinimum(e.target.value)}/></label>
 <label>Giá mỗi đơn vị (đ/{i.unit})<input name="unitCost" required type="number" min="0" step="0.001" value={cost} onChange={e=>setCost(e.target.value)}/></label>
 {stale&&<p role="status">Dữ liệu đã thay đổi trên server. {dirty?'Nội dung đang nhập được giữ nguyên. ':''}<button type="button" onClick={reload}>Tải lại dữ liệu nguyên liệu</button></p>}
 <button disabled={disabled||stale}>Lưu nguyên liệu đã sửa</button>
 </form></details>;
}

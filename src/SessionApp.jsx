import React, { useCallback, useEffect, useState } from 'react';
import { CafeApp } from './CafeApp.jsx';
import { request } from './api-client.js';

export function SessionApp() {
 const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{request('/api/v1/me').then(setUser).catch(e=>{if(e.status!==401)setError(e.message);}).finally(()=>setLoading(false));},[]);
 const logout=useCallback(async()=>{try{await request('/api/auth/sign-out',{method:'POST',body:{}});setUser(null);setPassword('');setError('');}catch(e){setError('Chưa xác nhận đăng xuất: '+e.message);}},[]);
 const expired=useCallback(()=>{setUser(null);setPassword('');setError('Phiên đăng nhập hoặc quyền truy cập đã hết hiệu lực.');},[]);
 if(loading)return <main aria-busy="true"><p>Đang kiểm tra phiên đăng nhập…</p></main>;
 if(user)return <>{error&&<p role="alert" className="alert">{error}</p>}<CafeApp key={user.id} user={user} onLogout={logout} onSessionExpired={expired}/></>;
 return <main className="login-page"><section className="panel login-panel"><p className="eyebrow">TRẠM CÀ PHÊ</p><h1>Đăng nhập</h1><p>Bán hàng, tồn kho và ca làm trên cùng dữ liệu PC/điện thoại.</p>
  {error&&<p role="alert" className="alert">{error}</p>}
  <form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{await request('/api/auth/sign-in/email',{method:'POST',body:{email,password}});setUser(await request('/api/v1/me'));setPassword('');}catch(err){setError(err.message);}finally{setBusy(false);}}}>
   <label>Email<input type="email" autoComplete="username" required value={email} disabled={busy} onChange={e=>setEmail(e.target.value)}/></label>
   <label>Mật khẩu<input type="password" autoComplete="current-password" required value={password} disabled={busy} onChange={e=>setPassword(e.target.value)}/></label>
   <button className="primary" disabled={busy}>{busy?'Đang đăng nhập…':'Đăng nhập'}</button>
  </form><p className="hint">Tài khoản do quản trị cấp; không có đăng ký công khai. Backend chưa được cấu hình sẽ báo lỗi, không tự dùng dữ liệu giả.</p>

 </section></main>;
}

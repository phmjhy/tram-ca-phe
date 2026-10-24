import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Coffee, LayoutDashboard, ShoppingCart, ClipboardList, BookOpen, Plus, Minus, Check, Search } from 'lucide-react';
import { channels, channelName, fmt, businessDate, report, parsePrice, quantity, totalItems } from './domain.js';
import { createRepository } from './storage.js';
import './style.css';

// Access lazily so a browser denying storage produces an actionable UI error.
const repository = createRepository({
  getItem: key => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  key: index => window.localStorage.key(index),
  get length() { return window.localStorage.length; },
});
const navigation = [
  ['pos', 'Bán hàng', ShoppingCart], ['orders', 'Đơn hàng', ClipboardList],
  ['menu', 'Sản phẩm', BookOpen], ['reports', 'Báo cáo', LayoutDashboard],
];
const dateTime = value => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });

function App() {
  const [page, setPage] = useState('pos');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const draftId = useRef(crypto.randomUUID());
  const [cart, setCart] = useState([]);
  const [channel, setChannel] = useState('store');
  const [query, setQuery] = useState('');
  const [note, setNote] = useState('');
  const [customer, setCustomer] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [appCode, setAppCode] = useState('');
  const [paid, setPaid] = useState(false);
  const [day, setDay] = useState(businessDate);

  function refresh() {
    try { setData(repository.read()); setError(''); }
    catch (err) { setData(null); setError(err.message); }
  }
  useEffect(() => {
    refresh();
    const sync = event => { if (event.key === null || event.key.startsWith('tram_')) refresh(); };
    window.addEventListener('storage', sync);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('focus', refresh); };
  }, []);

  async function perform(operation, success) {
    if (working.current) return false;
    working.current = true;
    setBusy(true); setError(''); setNotice('');
    try {
      await operation();
      setData(repository.read());
      success?.();
      return true;
    } catch (err) { setError(err.message || 'Không lưu được. Giỏ và dữ liệu gốc được giữ nguyên.'); return false; }
    finally { working.current = false; setBusy(false); }
  }
  function add(product) {
    if (busy) return;
    setError('');
    setCart(current => {
      const found = current.find(item => item.id === product.id);
      if (found?.qty === 999) return current;
      return found ? current.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
        : [...current, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  }
  function changeQty(id, delta) {
    setCart(current => current.flatMap(item => {
      if (item.id !== id) return [item];
      if (item.qty + delta === 0) return [];
      return [{ ...item, qty: quantity(Math.min(999, item.qty + delta)) }];
    }));
  }
  function changeChannel(next) {
    setChannel(next); setCustomer(''); setPhone(''); setAddress(''); setAppCode('');
  }
  function place() {
    const draft = { id: draftId.current, items: cart, channel, note, customer, phone, address, appCode, paid };
    void perform(() => repository.create(draft), () => {
      draftId.current = crypto.randomUUID();
      setCart([]); setNote(''); setCustomer(''); setPhone(''); setAddress(''); setAppCode(''); setPaid(false);
      setNotice('Đã lưu đơn trên trình duyệt này.'); setPage('orders');
    });
  }
  function updateCart() {
    setCart(current => current.flatMap(item => {
      const product = data.products.find(p => p.id === item.id && p.active);
      return product ? [{ ...item, name: product.name, price: product.price }] : [];
    }));
    setError(''); setNotice('Đã cập nhật giỏ theo menu hiện tại. Kiểm tra tổng trước khi lưu.');
  }
  let total = 0;
  let totalError = '';
  try { total = cart.length ? totalItems(cart) : 0; } catch (err) { totalError = err.message; }
  const reportResult = useMemo(() => {
    if (!data || page !== 'reports') return {};
    try { return { summary: report(data.orders, day) }; }
    catch (err) { return { error: err.message }; }
  }, [data, day, page]);
  const summary = reportResult.summary;
  function navButtons() {
    return navigation.map(([id, name, Icon]) => <button key={id} aria-current={page === id ? 'page' : undefined}
      className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={19} aria-hidden="true"/><span>{name}</span></button>);
  }
  return <div className="app">
    <aside className="sidebar"><div className="brand"><Coffee size={28}/><div><strong>TRẠM CÀ PHÊ</strong><small>Quản lý bán hàng</small></div></div>
      <nav aria-label="Điều hướng chính">{navButtons()}</nav><div className="sidebar-foot">Một quán · Bốn kênh bán</div></aside>
    <main>
      <header><div><p className="eyebrow">TRẠM CÀ PHÊ / POS DEMO</p><h1>{navigation.find(item => item[0] === page)[1]}</h1></div><span className="today">{businessDate()}</span></header>
      <p className="demo-banner">Bản demo · Dữ liệu chỉ lưu trong trình duyệt này, chưa đồng bộ PC/điện thoại, chưa có backend và phân quyền. Không dùng bán hàng thật hoặc nhập thông tin khách thật.</p>
      {error && <div role="alert" className="alert">{error}</div>}
      {notice && <p role="status" className="notice">{notice}</p>}
      {!data && <section className="panel"><p>Chưa đọc được dữ liệu. Không tự xóa hay thay thế lịch sử.</p><button onClick={refresh}>Đọc lại dữ liệu</button></section>}
      {data && page === 'pos' && <div className="pos-layout">
        <section className="panel"><div className="panel-header"><h2>Chọn món</h2><div className="search"><Search size={17}/><input aria-label="Tìm đồ uống" placeholder="Tìm đồ uống…" value={query} onChange={e => setQuery(e.target.value)}/></div></div>
          <div className="product-grid">{data.products.filter(p => p.active && p.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))).map(product =>
            <button disabled={busy} className="product" key={product.id} onClick={() => add(product)}><span className="product-icon"><Coffee size={22}/></span><span className="product-name">{product.name}</span><small>{product.category}</small><strong>{fmt(product.price)}</strong><span className="add-icon"><Plus size={16}/></span></button>)}</div>
          {!data.products.some(p => p.active && p.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'))) && <p className="empty">Không có món phù hợp.</p>}
        </section>
        <section className="panel cart"><h2>Đơn mới</h2><fieldset disabled={busy}><legend>Kênh bán</legend><div className="channel-grid">{channels.map(c => <button key={c.id} aria-pressed={channel === c.id} className={channel === c.id ? 'selected' : ''} onClick={() => changeChannel(c.id)}>{c.name}</button>)}</div></fieldset>
          <fieldset disabled={busy} className="form-stack"><legend>Thông tin đơn</legend>
            {channel === 'hotline' && <><label>Tên khách (tùy chọn)<input value={customer} onChange={e => setCustomer(e.target.value)}/></label><label>Số điện thoại *<input type="tel" value={phone} onChange={e => setPhone(e.target.value)}/></label><label>Địa chỉ giao *<input value={address} onChange={e => setAddress(e.target.value)}/></label></>}
            {channel === 'app' && <label>Mã đơn App (tùy chọn)<input value={appCode} onChange={e => setAppCode(e.target.value)}/><small>Nhập thủ công; không kết nối app giao hàng.</small></label>}
          </fieldset>
          <div className="cart-items">{cart.length === 0 ? <p className="empty">Chọn món để bắt đầu</p> : cart.map(item => <div className="cart-item" key={item.id}><div><strong>{item.name}</strong><small>{fmt(item.price)} / món</small></div><div className="quantity"><button disabled={busy} aria-label={`Giảm ${item.name}`} onClick={() => changeQty(item.id, -1)}><Minus size={14}/></button><b>{item.qty}</b><button disabled={busy || item.qty >= 999} aria-label={`Tăng ${item.name}`} onClick={() => changeQty(item.id, 1)}><Plus size={14}/></button></div></div>)}</div>
          <button className="text-button" disabled={busy || !cart.length} onClick={updateCart}>Cập nhật giỏ theo menu</button>
          <label className="field-label">Ghi chú đơn<textarea disabled={busy} rows={2} value={note} onChange={e => setNote(e.target.value)}/></label>
          <label className="paid-choice"><input type="checkbox" disabled={busy} checked={paid} onChange={e => setPaid(e.target.checked)}/> Đã thanh toán</label>
          <div className="total"><span>Tổng đơn</span><strong>{totalError ? 'Vượt giới hạn' : fmt(total)}</strong></div>{totalError && <p role="alert">{totalError}</p>}<button className="primary" disabled={busy || !cart.length || Boolean(totalError)} onClick={place}><Plus size={18}/>{busy ? 'Đang lưu…' : 'Lưu đơn hàng'}</button>
        </section>
      </div>}
      {data && page === 'orders' && <section className="panel"><div className="panel-header"><h2>Đơn đã lưu</h2><span className="muted">{data.orders.length} đơn</span></div>
        {!data.orders.length && <p className="empty">Chưa có đơn hàng</p>}<div className="order-list">{data.orders.map(order => <article className="order" key={order.storageId}>
          <div className="order-head"><div><strong className="order-code" title={order.code || order.id}>#{order.code || order.id}</strong><small>{channelName(order.channel)} · {dateTime(order.createdAt)}</small></div><span className={`status ${order.cancelled ? 'cancelled' : order.paid ? 'paid' : ''}`}>{order.cancelled ? 'Đã hủy (đơn cũ)' : order.paid ? 'Đã thanh toán' : 'Chưa thanh toán'}</span></div>
          <div className="order-items">{order.items.map((item, index) => <div key={index}>{item.qty} × {item.name} · {fmt(item.price)}</div>)}</div>
          {order.note && <p className="order-note">Ghi chú: {order.note}</p>}
          {order.channel === 'hotline' && <p className="order-note">Giao: {order.customer} · {order.phone} · {order.address}</p>}
          {order.appCode && <p className="order-note">Mã App: {order.appCode}</p>}
          {order.paid && <p className="order-note">{order.paidAt ? `Thanh toán: ${dateTime(order.paidAt)}` : 'Đơn cũ: chưa biết thời điểm thanh toán.'}</p>}
          {order.legacy?.shipping > 0 && <p className="order-note">Tổng lịch sử giữ nguyên, gồm phí giao cũ {fmt(order.legacy.shipping)}.</p>}
          <div className="order-bottom"><strong>{fmt(order.total)}</strong>{!order.cancelled && !order.paid && <div className="actions"><button disabled={busy} onClick={() => { if (window.confirm('Xác nhận đã nhận đủ tiền cho đơn này?')) void perform(() => repository.pay(order.storageId), () => setNotice('Đã ghi nhận thanh toán.')); }}><Check size={16}/> Xác nhận đã thanh toán</button></div>}</div>
        </article>)}</div></section>}
      {data && page === 'menu' && <section className="panel"><h2>Sản phẩm</h2><ProductForm busy={busy} onSave={product => perform(() => repository.addProduct(product), () => setNotice('Đã thêm món.'))}/>
        {data.products.map(product => <ProductRow key={product.id} product={product} busy={busy} onSave={changes => perform(() => repository.updateProduct(product.id, changes), () => setNotice('Đã cập nhật món; đơn cũ giữ nguyên giá.'))}/>)}</section>}
      {reportResult.error && <p role="alert" className="alert">Không tính được báo cáo: {reportResult.error}</p>}
      {summary && page === 'reports' && <><div className="report-filter"><label>Ngày báo cáo (giờ Việt Nam)<input type="date" value={day} onChange={e => { if (e.target.value) setDay(e.target.value); }}/></label></div>
        <div className="stats">{[['Doanh số đơn ngày', summary.sales], ['Đã thanh toán của đơn ngày', summary.paid], ['Chưa thanh toán của đơn ngày', summary.unpaid]].map(([label, value]) => <div className="stat" key={label}><small>{label}</small><strong>{fmt(value)}</strong></div>)}</div>
        <section className="panel"><h2>Doanh số theo kênh · {summary.count} đơn</h2><div className="table-scroll"><table><thead><tr><th>Kênh</th><th>Đơn</th><th>Doanh số</th><th>Đã thanh toán</th><th>Chưa thanh toán</th></tr></thead><tbody>{summary.rows.map(row => <tr key={row.id}><th scope="row">{row.name}</th><td>{row.count}</td><td>{fmt(row.sales)}</td><td>{fmt(row.paid)}</td><td>{fmt(row.unpaid)}</td></tr>)}</tbody></table></div>
          <p>Khoản thanh toán ghi nhận trong ngày: <strong>{fmt(summary.received)}</strong></p><p className="hint">Doanh số theo ngày tạo đơn; khoản thanh toán theo thời điểm xác nhận thu, có thể gồm đơn ngày trước. Đơn hủy cũ không tính. Tổng đã/chưa thanh toán phản ánh trạng thái hiện tại của đơn ngày.</p>
          {summary.unknownPaidAt > 0 && <p className="hint">Có {summary.unknownPaidAt} đơn cũ đã thanh toán chưa biết ngày thu; không đưa vào khoản thanh toán ghi nhận theo ngày.</p>}
          {summary.legacyTotals > 0 && <p className="hint">Có {summary.legacyTotals} đơn ngày có phí giao cũ; giữ nguyên tổng lịch sử.</p>}
        </section></>}
    </main><nav className="mobile-nav" aria-label="Điều hướng điện thoại">{navButtons()}</nav>
  </div>;
}
function ProductForm({ busy, onSave }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Cà phê');
  const [error, setError] = useState('');
  return <form className="add-form" onSubmit={async event => {
    event.preventDefault(); setError('');
    try {
      const product = { id: crypto.randomUUID(), name: name.trim(), price: parsePrice(price), category, active: true };
      if (!product.name) throw new Error('Nhập tên món.');
      if (await onSave(product)) { setName(''); setPrice(''); }
    } catch (err) { setError(err.message); }
  }}><label>Tên món<input required disabled={busy} value={name} onChange={e => setName(e.target.value)}/></label><label>Giá (VND)<input required inputMode="numeric" disabled={busy} value={price} onChange={e => setPrice(e.target.value)}/></label><label>Nhóm<select disabled={busy} value={category} onChange={e => setCategory(e.target.value)}><option>Cà phê</option><option>Trà</option><option>Khác</option></select></label><button className="primary" disabled={busy}>Thêm món</button>{error && <p role="alert">{error}</p>}</form>;
}
function ProductRow({ product, busy, onSave }) {
  const [price, setPrice] = useState(String(product.price));
  const [error, setError] = useState('');
  useEffect(() => { setPrice(String(product.price)); }, [product.price]);
  return <div className="menu-row"><div><strong>{product.name}</strong><small>{product.category}</small></div><form className="price-form" onSubmit={event => {
    event.preventDefault(); setError('');
    try { void onSave({ price: parsePrice(price) }); } catch (err) { setError(err.message); }
  }}><input aria-label={`Giá ${product.name}`} inputMode="numeric" disabled={busy} value={price} onChange={e => setPrice(e.target.value)}/><button disabled={busy}>Lưu giá</button>{error && <span role="alert">{error}</span>}</form><label className="toggle"><input type="checkbox" disabled={busy} checked={product.active} onChange={event => void onSave({ active: event.target.checked })}/> Đang bán</label></div>;
}

createRoot(document.getElementById('root')).render(<App/>);

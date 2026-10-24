export const channels = [
  { id: 'store', name: 'Tại quán' },
  { id: 'takeaway', name: 'Mang đi' },
  { id: 'app', name: 'App' },
  { id: 'hotline', name: 'Hotline' },
];
export const seed = [
  { id: 1, name: 'Cà phê đen', category: 'Cà phê', price: 22000, active: true },
  { id: 2, name: 'Cà phê sữa', category: 'Cà phê', price: 27000, active: true },
  { id: 3, name: 'Bạc xỉu', category: 'Cà phê', price: 29000, active: true },
  { id: 4, name: 'Trà đào cam sả', category: 'Trà', price: 35000, active: true },
  { id: 5, name: 'Trà tắc', category: 'Trà', price: 22000, active: true },
  { id: 6, name: 'Matcha latte', category: 'Khác', price: 39000, active: true },
];
export const fmt = value => new Intl.NumberFormat('vi-VN').format(value) + 'đ';
export const channelName = id => channels.find(channel => channel.id === id)?.name ?? 'Kênh cũ khác';
export function money(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error('Giá phải là số nguyên VND không âm và trong giới hạn an toàn.');
  }
  return value;
}
export function parsePrice(value) {
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) throw new Error('Nhập giá nguyên VND hợp lệ.');
  return money(Number(value));
}
export function quantity(value) {
  if (!Number.isInteger(value) || value < 1 || value > 999) throw new Error('Số lượng phải từ 1 đến 999.');
  return value;
}
export function totalItems(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('Đơn cần ít nhất một món.');
  return items.reduce((sum, item) => money(sum + money(item.price) * quantity(item.qty)), 0);
}
export function validateProducts(products) {
  if (!Array.isArray(products)) throw new Error('Dữ liệu menu không hợp lệ.');
  const ids = new Set();
  for (const p of products) {
    if (!p || !['string', 'number'].includes(typeof p.id) || ids.has(String(p.id)) ||
        typeof p.name !== 'string' || !p.name.trim() || typeof p.category !== 'string' || typeof p.active !== 'boolean') {
      throw new Error('Dữ liệu món không hợp lệ hoặc trùng ID.');
    }
    money(p.price);
    ids.add(String(p.id));
  }
  return products;
}
const isDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function validateOrder(order) {
  if (!order || typeof order.id !== 'string' || typeof order.storageId !== 'string' || !order.storageId ||
      !isDate(order.createdAt) || typeof order.paid !== 'boolean' || !Array.isArray(order.items) ||
      typeof order.channel !== 'string') throw new Error('Dữ liệu đơn không hợp lệ. Giữ nguyên dữ liệu để kiểm tra.');
  money(order.total);
  totalItems(order.items);
  for (const item of order.items) if (typeof item.name !== 'string') throw new Error('Tên món trong đơn không hợp lệ.');
  if (order.paidAt !== null && !isDate(order.paidAt)) throw new Error('Ngày thanh toán không hợp lệ.');
  if (!order.paid && order.paidAt !== null) throw new Error('Đơn chưa thanh toán không thể có ngày thu.');
  if (!order.legacy && (!channels.some(c => c.id === order.channel) || order.total !== totalItems(order.items) || (order.paid && !order.paidAt))) {
    throw new Error('Tổng hoặc kênh/ngày thu của đơn mới không hợp lệ.');
  }
  return order;
}
export function legacyOrder(raw, index) {
  if (!raw || typeof raw !== 'object' || typeof raw.paid !== 'boolean') throw new Error('Đơn cũ không hợp lệ; không ghi đè dữ liệu.');
  return validateOrder({
    ...raw,
    id: typeof raw.id === 'string' ? raw.id : `legacy-${index}`,
    storageId: `legacy-${index}`,
    channel: ['grab', 'shopee'].includes(raw.channel) ? 'app' : String(raw.channel ?? 'unknown'),
    paidAt: raw.paid ? (raw.paidAt ?? null) : null,
    cancelled: raw.status === 'cancelled',
    legacy: { ...raw },
  });
}
export function createOrder(draft, products, now = new Date().toISOString()) {
  if (!channels.some(c => c.id === draft.channel)) throw new Error('Kênh bán không hợp lệ.');
  if (typeof draft.id !== 'string' || !draft.id || !isDate(now)) throw new Error('ID hoặc thời gian không hợp lệ.');
  if (!Array.isArray(draft.items) || !draft.items.length) throw new Error('Chọn món trước khi lưu đơn.');
  const seen = new Set();
  const items = draft.items.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product?.active) throw new Error('Một món đã ngừng bán. Vui lòng cập nhật giỏ.');
    if (seen.has(String(item.id))) throw new Error('Món trùng trong giỏ.');
    seen.add(String(item.id));
    money(item.price);
    if (product.price !== item.price) throw new Error('Giá món đã đổi. Bấm “Cập nhật giỏ” rồi kiểm tra lại tổng.');
    return { id: product.id, name: product.name, price: money(product.price), qty: quantity(item.qty) };
  });
  const text = value => typeof value === 'string' ? value.trim() : '';
  if (draft.channel === 'hotline' && (!text(draft.phone) || !text(draft.address))) throw new Error('Hotline cần số điện thoại và địa chỉ.');
  return validateOrder({
    schemaVersion: 2, id: draft.id, storageId: draft.id, code: `TC-${draft.id}`,
    channel: draft.channel, items, total: totalItems(items), note: text(draft.note),
    customer: draft.channel === 'hotline' ? text(draft.customer) : '',
    phone: draft.channel === 'hotline' ? text(draft.phone) : '',
    address: draft.channel === 'hotline' ? text(draft.address) : '',
    appCode: draft.channel === 'app' ? text(draft.appCode) : '',
    createdAt: now, paid: draft.paid === true, paidAt: draft.paid === true ? now : null, cancelled: false,
  });
}
export function markPaid(order, now = new Date().toISOString()) {
  validateOrder(order);
  if (order.cancelled) throw new Error('Đơn hủy cũ chỉ được xem.');
  if (order.paid) return order;
  return validateOrder({ ...order, schemaVersion: 2, paid: true, paidAt: now });
}
export function businessDate(value = new Date()) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Ngày không hợp lệ.');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function report(orders, day) {
  const active = orders.filter(o => !o.cancelled);
  const daily = active.filter(o => businessDate(o.createdAt) === day);
  const summarize = list => ({
    count: list.length,
    sales: list.reduce((s, o) => money(s + o.total), 0),
    paid: list.filter(o => o.paid).reduce((s, o) => money(s + o.total), 0),
    unpaid: list.filter(o => !o.paid).reduce((s, o) => money(s + o.total), 0),
  });
  const unknown = daily.filter(o => !channels.some(c => c.id === o.channel));
  return {
    ...summarize(daily),
    received: active.filter(o => o.paid && o.paidAt && businessDate(o.paidAt) === day).reduce((s, o) => money(s + o.total), 0),
    unknownPaidAt: active.filter(o => o.paid && !o.paidAt).length,
    legacyTotals: daily.filter(o => o.legacy && o.legacy.shipping > 0).length,
    rows: [...channels.map(c => ({ ...c, ...summarize(daily.filter(o => o.channel === c.id)) })),
      ...(unknown.length ? [{ id: 'unknown', name: 'Kênh cũ khác', ...summarize(unknown) }] : [])],
  };
}

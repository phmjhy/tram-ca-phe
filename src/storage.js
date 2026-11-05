import { seed, validateProducts, legacyOrder, validateOrder, createOrder, markPaid } from './domain.js';
const ORDER_PREFIX = 'tram_order_v2:';
const MENU_KEY = 'tram_products_v2';
const LOCK = 'tram-pos-write-v2';
export function createRepository(storage, locks = globalThis.navigator?.locks) {
  function parse(key, fallback) {
    const value = storage.getItem(key);
    if (value === null) return fallback;
    try { return JSON.parse(value); } catch { throw new Error(`Dữ liệu ${key} bị hỏng. Không ghi đè; cần khôi phục bản sao.`); }
  }
  function read() {
    const products = validateProducts(parse(MENU_KEY, parse('tram_products', seed)));
    const legacy = parse('tram_orders', []);
    if (!Array.isArray(legacy)) throw new Error('Danh sách đơn cũ bị hỏng. Không ghi đè dữ liệu.');
    const orders = new Map(legacy.map((raw, index) => { const o = legacyOrder(raw, index); return [o.storageId, o]; }));
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(ORDER_PREFIX)) continue;
      const order = validateOrder(parse(key));
      if (order.schemaVersion !== 2 || ORDER_PREFIX + order.storageId !== key) throw new Error('Khóa đơn v2 không hợp lệ.');
      orders.set(order.storageId, order);
    }
    return { products, orders: [...orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)) };
  }
  async function write(operation) {
    if (!locks?.request) throw new Error('Trình duyệt thiếu Web Locks. Chỉ xem dữ liệu; dùng Chrome/Safari/Firefox phiên bản hỗ trợ để lưu demo.');
    return locks.request(LOCK, async () => operation(read()));
  }
  return {
    read,
    create: draft => write(data => {
      const existing = data.orders.find(o => o.storageId === draft.id);
      if (existing) return existing;
      const order = createOrder(draft, data.products);
      if (order.appCode && data.orders.some(o => o.channel === 'app' && !o.cancelled && String(o.appCode ?? '').trim().toLowerCase() === order.appCode.toLowerCase())) {
        throw new Error('Mã đơn App đã tồn tại. Kiểm tra danh sách đơn trước khi nhập lại.');
      }
      storage.setItem(ORDER_PREFIX + order.storageId, JSON.stringify(order));
      return order;
    }),
    pay: storageId => write(data => {
      const order = data.orders.find(o => o.storageId === storageId);
      if (!order) throw new Error('Không tìm thấy đơn.');
      const paid = markPaid(order);
      if (paid !== order) storage.setItem(ORDER_PREFIX + storageId, JSON.stringify(paid));
      return paid;
    }),
    addProduct: product => write(data => {
      if (data.products.some(p => String(p.id) === String(product.id))) throw new Error('ID món đã tồn tại.');
      const next = validateProducts([...data.products, product]);
      storage.setItem(MENU_KEY, JSON.stringify(next));
    }),
    updateProduct: (id, changes) => write(data => {
      if (!data.products.some(p => p.id === id)) throw new Error('Món không còn tồn tại.');
      const next = validateProducts(data.products.map(p => p.id === id ? { ...p, ...changes, id: p.id } : p));
      storage.setItem(MENU_KEY, JSON.stringify(next));
    }),
  };
}

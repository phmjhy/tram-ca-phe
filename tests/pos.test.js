import test from 'node:test';
import assert from 'node:assert/strict';
import { channels, seed, parsePrice, quantity, totalItems, createOrder, legacyOrder, markPaid, report, businessDate } from '../src/domain.js';
import { createRepository } from '../src/storage.js';

const now = '2026-10-24T03:00:00.000Z';
function draft(overrides = {}) {
  return { id: 'order-1', channel: 'store', items: [{ id: 1, name: 'Cà phê đen', price: 22000, qty: 2 }], ...overrides };
}
function old(overrides = {}) {
  return { id: 'old', code: 'TC123', channel: 'grab', items: [{ id: 1, name: 'Giá cũ', price: 20000, qty: 1 }], total: 25000, shipping: 5000,
    payment: 'cash', paid: true, status: 'done', createdAt: now, ...overrides };
}
class Storage {
  map = new Map(); fail = false;
  get length() { return this.map.size; }
  key(i) { return [...this.map.keys()][i] ?? null; }
  getItem(k) { return this.map.get(k) ?? null; }
  setItem(k, v) { if (this.fail) throw new Error('QuotaExceeded'); this.map.set(k, String(v)); }
}
function setup() {
  const storage = new Storage();
  let tail = Promise.resolve();
  const locks = { request: (_name, fn) => { const result = tail.then(fn); tail = result.catch(() => {}); return result; } };
  return { storage, repo: createRepository(storage, locks), second: createRepository(storage, locks) };
}

test('exactly four channels; all default unpaid including App', () => {
  assert.deepEqual(channels.map(c => c.id), ['store', 'takeaway', 'app', 'hotline']);
  for (const c of channels) {
    const o = createOrder(draft({ channel: c.id, phone: 'TEST', address: 'TEST' }), seed, now);
    assert.equal(o.paid, false); assert.equal(o.paidAt, null); assert.equal(o.total, 44000);
    assert.equal('shipping' in o, false); assert.equal('payment' in o, false); assert.equal('status' in o, false);
  }
});
test('explicit paid on creation sets timestamp; snapshot does not mutate with menu', () => {
  const products = structuredClone(seed);
  const o = createOrder(draft({ paid: true }), products, now);
  products[0].price = 99999;
  assert.equal(o.items[0].price, 22000); assert.equal(o.paidAt, now);
});
test('price validation rejects invalid values, accepts zero', () => {
  for (const p of ['', ' ', '-1', '1.2', 'NaN', 'Infinity', '1e4', '9007199254740992']) assert.throws(() => parsePrice(p));
  assert.equal(parsePrice('0'), 0); assert.equal(parsePrice('22000'), 22000);
  for (const price of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => totalItems([{ price, qty: 1 }]));
});
test('quantity and total overflow rejected', () => {
  for (const q of [0, -1, 1.2, NaN, Infinity, 1000, '1']) assert.throws(() => quantity(q));
  assert.equal(quantity(999), 999);
  assert.throws(() => totalItems([{ price: Number.MAX_SAFE_INTEGER, qty: 2 }]));
});
test('empty/duplicate/missing/disabled products and changed price blocked at checkout', () => {
  assert.throws(() => createOrder(draft({ items: [] }), seed, now));
  assert.throws(() => createOrder(draft({ items: [...draft().items, ...draft().items] }), seed, now));
  assert.throws(() => createOrder(draft(), [], now));
  assert.throws(() => createOrder(draft(), seed.map(p => ({ ...p, active: false })), now));
  assert.throws(() => createOrder(draft(), seed.map(p => ({ ...p, price: p.price + 1 })), now), /Giá món đã đổi/);
});
test('Hotline requires phone/address, no ship; other channels drop customer fields', () => {
  assert.throws(() => createOrder(draft({ channel: 'hotline' }), seed, now));
  const o = createOrder(draft({ channel: 'hotline', phone: ' TEST ', address: ' TEST ', shipping: 99999 }), seed, now);
  assert.equal(o.total, 44000); assert.equal(o.phone, 'TEST'); assert.equal('shipping' in o, false);
  const store = createOrder(draft({ phone: 'SECRET', address: 'SECRET', customer: 'SECRET', appCode: 'APP' }), seed, now);
  assert.equal(store.phone, ''); assert.equal(store.address, ''); assert.equal(store.customer, ''); assert.equal(store.appCode, '');
});
test('paidAt is idempotent, cancelled legacy is read-only', () => {
  const o = createOrder(draft(), seed, now);
  const paid = markPaid(o, '2026-10-25T03:00:00Z');
  assert.equal(markPaid(paid, now).paidAt, paid.paidAt);
  assert.throws(() => markPaid(legacyOrder(old({ status: 'cancelled' }), 0)));
});
test('legacy channels/states retain originals, totals, snapshots and unknown paidAt', () => {
  for (const channel of ['grab', 'shopee', 'store', 'hotline', 'unknown']) {
    for (const status of ['new', 'preparing', 'ready', 'done', 'cancelled']) {
      const raw = old({ channel, status }); const copy = structuredClone(raw); const o = legacyOrder(raw, 0);
      assert.deepEqual(raw, copy); assert.deepEqual(o.legacy, raw); assert.equal(o.total, 25000);
      assert.equal(o.items[0].price, 20000); assert.equal(o.paidAt, null);
      assert.equal(o.channel, ['grab', 'shopee'].includes(channel) ? 'app' : channel);
      assert.equal(o.cancelled, status === 'cancelled');
    }
  }
});
test('legacy overlay preserves old keys byte-for-byte and duplicate IDs', async () => {
  const { storage, repo } = setup();
  const raw = JSON.stringify([old({ paid: false }), old({ channel: 'shopee', paid: false })]);
  storage.setItem('tram_orders', raw); storage.setItem('tram_products', JSON.stringify(seed));
  const productsRaw = storage.getItem('tram_products');
  assert.equal(repo.read().orders.length, 2); assert.equal(storage.length, 2);
  await repo.pay('legacy-0');
  await repo.create(draft());
  await repo.updateProduct(1, { price: 30000 });
  const data = repo.read(); assert.equal(data.orders.length, 3);
  assert.equal(data.orders.find(o => o.storageId === 'legacy-0').paid, true);
  assert.equal(data.orders.find(o => o.storageId === 'legacy-1').paid, false);
  assert.equal(storage.getItem('tram_orders'), raw); assert.equal(storage.getItem('tram_products'), productsRaw);
});
test('rapid/concurrent submit with same ID saves exactly one order', async () => {
  const { storage, repo, second } = setup();
  const result = await Promise.all([repo.create(draft()), second.create(draft()), repo.create(draft())]);
  assert.equal(repo.read().orders.length, 1); assert.equal(storage.length, 1);
  assert.equal(result[0].createdAt, result[2].createdAt);
});
test('distinct intentional orders with same items both survive', async () => {
  const { repo, second } = setup();
  await Promise.all([repo.create(draft()), second.create(draft({ id: 'order-2' }))]);
  assert.equal(repo.read().orders.length, 2);
});
test('concurrent app reference uniqueness and repeated payment', async () => {
  const { repo, second } = setup();
  const result = await Promise.allSettled([
    repo.create(draft({ channel: 'app', appCode: 'REF' })),
    second.create(draft({ id: 'order-2', channel: 'app', appCode: ' ref ' })),
  ]);
  assert.equal(result.filter(r => r.status === 'rejected').length, 1);
  const [a, b] = await Promise.all([repo.pay('order-1'), second.pay('order-1')]);
  assert.equal(a.paidAt, b.paidAt); assert.equal(repo.read().orders.length, 1);
});
test('quota failure does not persist; retry same draft creates once', async () => {
  const { storage, repo } = setup(); storage.fail = true;
  await assert.rejects(repo.create(draft()), /Quota/); assert.equal(repo.read().orders.length, 0);
  storage.fail = false; await repo.create(draft()); await repo.create(draft()); assert.equal(repo.read().orders.length, 1);
});
test('failed payment/menu write does not alter persisted values', async () => {
  const { storage, repo } = setup(); await repo.create(draft()); storage.fail = true;
  await assert.rejects(repo.pay('order-1')); await assert.rejects(repo.updateProduct(1, { price: 0 }));
  assert.equal(repo.read().orders[0].paid, false); assert.equal(repo.read().products[0].price, 22000);
});
test('malformed legacy JSON/schema blocks writes without resetting history', async () => {
  for (const raw of ['{bad', '{}', '[null]', JSON.stringify([old({ total: -1 })])]) {
    const { storage, repo } = setup(); storage.setItem('tram_orders', raw);
    assert.throws(() => repo.read()); await assert.rejects(repo.create(draft()));
    assert.equal(storage.getItem('tram_orders'), raw); assert.equal(storage.length, 1);
  }
});
test('malformed product/v2 schema blocks writes', async () => {
  for (const [key, raw] of [['tram_products', '[null]'], ['tram_products_v2', '{}'], ['tram_order_v2:bad', '{}']]) {
    const { storage, repo } = setup(); storage.setItem(key, raw);
    assert.throws(() => repo.read()); await assert.rejects(repo.create(draft())); assert.equal(storage.getItem(key), raw);
  }
});
test('without Web Locks read works, write fails closed', async () => {
  const repo = createRepository(new Storage(), null);
  assert.equal(repo.read().products.length, 6); await assert.rejects(repo.create(draft()), /Web Locks/);
});
test('menu validates price, unique IDs, and retains untouched products', async () => {
  const { repo } = setup();
  await assert.rejects(repo.updateProduct(1, { price: -1 }));
  await assert.rejects(repo.addProduct(seed[0]));
  await repo.updateProduct(1, { price: 0 }); await repo.updateProduct(2, { active: false });
  assert.equal(repo.read().products[0].price, 0); assert.equal(repo.read().products[1].active, false);
});
test('reports distinguish order-day totals and payment-day receipts', () => {
  const first = createOrder(draft(), seed, '2026-10-23T03:00:00Z');
  const paid = markPaid(first, now);
  const unpaid = createOrder(draft({ id: 'order-2', channel: 'app' }), seed, now);
  const instant = createOrder(draft({ id: 'order-3', channel: 'takeaway', paid: true }), seed, now);
  const rows = [paid, unpaid, instant];
  const r = report(rows, '2026-10-24');
  assert.equal(r.sales, 88000); assert.equal(r.paid, 44000); assert.equal(r.unpaid, 44000); assert.equal(r.received, 88000);
  assert.equal(r.sales, r.paid + r.unpaid); assert.equal(r.rows.length, 4);
  assert.equal(report(rows, '2026-10-23').received, 0);
});
test('legacy unknown paidAt, old shipping and unknown channel explicit; cancelled excluded', () => {
  const r = report([legacyOrder(old(), 0), legacyOrder(old({ channel: 'other', paid: false }), 1), legacyOrder(old({ status: 'cancelled' }), 2)], '2026-10-24');
  assert.equal(r.sales, 50000); assert.equal(r.received, 0); assert.equal(r.unknownPaidAt, 1); assert.equal(r.legacyTotals, 2);
  assert.equal(r.rows.length, 5); assert.equal(r.rows.at(-1).sales, 25000);
});
test('Vietnam midnight independent of host timezone, empty report', () => {
  assert.equal(businessDate('2026-10-23T16:59:59Z'), '2026-10-23');
  assert.equal(businessDate('2026-10-23T17:00:00Z'), '2026-10-24');
  const r = report([], '2026-10-24'); assert.equal(r.sales, 0); assert.equal(r.received, 0); assert.equal(r.rows.length, 4);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import React from 'react';
import { transform } from 'esbuild';
import * as icons from 'lucide-react';
import * as domain from '../src/domain.js';
import { createRepository } from '../src/storage.js';

// Execute actual JSX handlers using existing Vite/esbuild tooling. No browser/DOM is simulated.
const transformed = await transform(fs.readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8'), { loader: 'jsx', format: 'cjs' });
function harness({ fail = false, legacy } = {}) {
  const map = new Map(legacy ? [['tram_orders', JSON.stringify(legacy)]] : []);
  const storage = {
    fail, get length() { return map.size; }, key: i => [...map.keys()][i] ?? null,
    getItem: k => map.get(k) ?? null, setItem(k, v) { if (this.fail) throw Error('Quota test'); map.set(k, v); },
  };
  let tail = Promise.resolve();
  const locks = { request: (_n, fn) => { const result = tail.then(fn); tail = result.catch(() => {}); return result; } };
  const slots = [], effects = [];
  const events = new Map();
  let cursor = 0, component;
  const react = {
    ...React,
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useEffect(fn) { const i = cursor++; if (!(i in slots)) { slots[i] = true; effects.push(fn); } },
    useMemo(fn) { cursor++; return fn(); },
  };
  const repo = createRepository(storage, locks);
  const context = vm.createContext({
    require: name => ({ react, 'react-dom/client': { createRoot: () => ({ render: element => { component = element.type; } }) },
      'lucide-react': icons, './domain.js': domain, './storage.js': { createRepository: () => repo }, './style.css': {} })[name],
    document: { getElementById: () => ({}) }, crypto: { randomUUID },
    window: { localStorage: storage, addEventListener(name, fn) { events.set(name, fn); }, removeEventListener() {}, confirm: () => true },
  });
  vm.runInContext(transformed.code, context);
  function render() { cursor = 0; const tree = component(); while (effects.length) effects.shift()(); return tree; }
  render();
  return { render, storage, repo, trigger: (name, value) => events.get(name)?.(value) };
}
function text(node) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  if (typeof node === 'object') return text(node.props?.children);
  return String(node);
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(n => nodes(n, predicate));
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)];
}
const button = (tree, label) => {
  const found = nodes(tree, n => n.type === 'button' && text(n) === label)[0];
  assert.ok(found, `button exists: ${label}`); return found;
};
const product = tree => nodes(tree, n => n.type === 'button' && n.props.className === 'product')[0];
const flush = () => new Promise(resolve => setImmediate(resolve));

test('UI has exactly four channels/navigation, no shipping/payment-method/kitchen controls', () => {
  const h = harness(); const tree = h.render();
  const channelButtons = nodes(tree, n => n.type === 'button' && 'aria-pressed' in n.props);
  assert.deepEqual(channelButtons.map(text), ['Tại quán', 'Mang đi', 'App', 'Hotline']);
  const nav = nodes(tree, n => n.type === 'nav')[0];
  assert.deepEqual(nodes(nav, n => n.type === 'button').map(text), ['Bán hàng', 'Đơn hàng', 'Sản phẩm', 'Báo cáo']);
  assert.doesNotMatch(text(tree), /GrabFood|ShopeeFood|Pha chế|Tiền mặt|Chuyển khoản|Phí ship/);
  button(tree, 'Hotline').props.onClick(); const hotline = h.render();
  assert.match(text(hotline), /Số điện thoại/); assert.doesNotMatch(text(hotline), /Phí ship/);
});
test('UI rapid save -> one unpaid App order -> confirm -> paidAt -> report', async () => {
  const h = harness(); let tree = h.render();
  button(tree, 'App').props.onClick(); product(tree).props.onClick(); tree = h.render();
  const save = button(tree, 'Lưu đơn hàng'); save.props.onClick(); save.props.onClick();
  assert.equal(button(h.render(), 'Đang lưu…').props.disabled, true);
  await flush(); tree = h.render();
  assert.equal(h.repo.read().orders.length, 1); assert.equal(h.repo.read().orders[0].paid, false);
  assert.match(text(tree), /Chưa thanh toán/);
  button(tree, ' Xác nhận đã thanh toán').props.onClick(); await flush(); tree = h.render();
  assert.equal(h.repo.read().orders[0].paid, true); assert.ok(h.repo.read().orders[0].paidAt);
  assert.match(text(tree), /Đã thanh toán/);
  button(tree, 'Báo cáo').props.onClick(); tree = h.render();
  assert.match(text(tree), /Doanh số đơn ngày/); assert.match(text(tree), /Khoản thanh toán ghi nhận trong ngày/);
  assert.ok(nodes(tree, n => n.type === 'table').length);
});
test('UI failed storage keeps cart and shows error; retry succeeds once', async () => {
  const h = harness({ fail: true }); let tree = h.render();
  product(tree).props.onClick(); tree = h.render(); button(tree, 'Lưu đơn hàng').props.onClick(); await flush(); tree = h.render();
  assert.match(text(tree), /Quota test/); assert.equal(h.repo.read().orders.length, 0);
  assert.equal(button(tree, 'Lưu đơn hàng').props.disabled, false);
  assert.equal(nodes(tree, n => n.props.className === 'cart-item').length, 1);
  h.storage.fail = false; button(tree, 'Lưu đơn hàng').props.onClick(); await flush();
  assert.equal(h.repo.read().orders.length, 1);
});
test('UI prevents missing Hotline details then saves without shipping', async () => {
  const h = harness(); let tree = h.render();
  button(tree, 'Hotline').props.onClick(); product(tree).props.onClick(); tree = h.render();
  button(tree, 'Lưu đơn hàng').props.onClick(); await flush(); tree = h.render();
  assert.match(text(tree), /Hotline cần số điện thoại/); assert.equal(h.repo.read().orders.length, 0);
  const inputs = nodes(tree, n => n.type === 'input');
  inputs.find(n => n.props.type === 'tel').props.onChange({ target: { value: 'TEST-PHONE' } });
  nodes(nodes(tree, n => n.type === 'label' && text(n).startsWith('Địa chỉ giao'))[0], n => n.type === 'input')[0].props.onChange({ target: { value: 'TEST-ADDRESS' } });
  tree = h.render(); button(tree, 'Lưu đơn hàng').props.onClick(); await flush();
  const saved = h.repo.read().orders[0]; assert.equal(saved.total, 22000); assert.equal('shipping' in saved, false);
});
test('UI explicitly paid at creation stores timestamp; product menu remains available', async () => {
  const h = harness(); let tree = h.render(); product(tree).props.onClick();
  nodes(tree, n => n.type === 'input' && n.props.type === 'checkbox')[0].props.onChange({ target: { checked: true } });
  tree = h.render(); button(tree, 'Lưu đơn hàng').props.onClick(); await flush();
  assert.equal(h.repo.read().orders[0].paid, true); assert.ok(h.repo.read().orders[0].paidAt);
  tree = h.render(); button(tree, 'Sản phẩm').props.onClick(); tree = h.render();
  assert.equal(nodes(tree, n => typeof n.type === 'function' && n.type.name === 'ProductRow').length, 6);
});


test('UI menu change requires refreshing cart; saved snapshot survives later edit', async () => {
  const h = harness(); let tree = h.render(); product(tree).props.onClick();
  await h.repo.updateProduct(1, { price: 30000 }); h.trigger('storage', { key: 'tram_products_v2' });
  tree = h.render(); button(tree, 'Lưu đơn hàng').props.onClick(); await flush(); tree = h.render();
  assert.match(text(tree), /Giá món đã đổi/); assert.equal(h.repo.read().orders.length, 0);
  button(tree, 'Cập nhật giỏ theo menu').props.onClick(); tree = h.render();
  button(tree, 'Lưu đơn hàng').props.onClick(); await flush();
  assert.equal(h.repo.read().orders[0].total, 30000);
  await h.repo.updateProduct(1, { price: 40000 }); assert.equal(h.repo.read().orders[0].items[0].price, 30000);
});
test('UI corrupted data blocks selling instead of empty-history fallback', () => {
  const h = harness(); h.storage.setItem('tram_orders', '{bad'); h.trigger('storage', { key: 'tram_orders' });
  const tree = h.render(); assert.match(text(tree), /bị hỏng/); assert.match(text(tree), /Không tự xóa/);
  assert.equal(nodes(tree, n => n.type === 'button' && n.props.className === 'product').length, 0);
});
test('UI total overflow displays error and disables save instead of crashing', async () => {
  const h = harness(); await h.repo.updateProduct(1, { price: Number.MAX_SAFE_INTEGER });
  h.trigger('storage', { key: 'tram_products_v2' }); let tree = h.render();
  product(tree).props.onClick(); product(tree).props.onClick(); tree = h.render();
  assert.match(text(tree), /Vượt giới hạn/); assert.equal(button(tree, 'Lưu đơn hàng').props.disabled, true);
});

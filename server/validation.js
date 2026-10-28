import { money, quantity, parsePrice } from '../src/domain.js';
export class HttpError extends Error { constructor(status, message, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; } }
export function requireOwner(actor) { if (actor.role !== 'owner') throw new HttpError(403, 'Chỉ chủ quán được thực hiện thao tác này.', 'FORBIDDEN'); }
export function fields(body, allowed) { if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) throw new HttpError(422, 'Dữ liệu có trường không được phép.'); }
export function text(value, max, required = false) {
 if (value === undefined && !required) return '';
 if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new HttpError(422, 'Nội dung không hợp lệ.');
 return value.trim();
}
export function price(value) { try { return typeof value === 'string' ? parsePrice(value) : money(value); } catch { throw new HttpError(422, 'Giá phải là số nguyên VND không âm.'); } }
export function qty(value) { try { return quantity(value); } catch { throw new HttpError(422, 'Số lượng phải từ 1 đến 999.'); } }
export function uuid(value) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(422, 'ID không hợp lệ.'); return value; }
export function date(value) { if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10)!==value) throw new HttpError(422,'Ngày không hợp lệ.'); return value; }

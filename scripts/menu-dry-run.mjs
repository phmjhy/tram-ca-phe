// Offline validation only: no database, HTTP, import or environment credentials.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const normalize = value => String(value ?? '').normalize('NFC').trim().toLocaleLowerCase('vi');
const unit = (value, approved = false) => ({ gram: 'g', g: 'g', ml: 'ml', 'cái': 'cái', ...(approved ? { chai: 'cái', 'hộp': 'cái' } : {}) })[normalize(value)] ?? null;
const present = value => value !== null && value !== undefined && value !== '';
const number = value => typeof value === 'number' && Number.isFinite(value);
const decimal = value => number(value) && /^\d{1,9}(\.\d{1,3})?$/.test(String(value));
const index = rows => {
  const map = new Map();
  rows.forEach((cells, i) => { if (!present(cells[0])) return; const key = normalize(cells[0]); map.set(key, [...(map.get(key) ?? []), { cells, row: i + 2 }]); });
  return map;
};

// Decimal half-up on the source decimal string, avoiding binary tie rounding.
export function roundUnitCost(value) {
  if (!Number.isFinite(value) || value < 0) return value;
  const [mantissa, exponent = '0'] = String(value).toLowerCase().split('e');
  const [whole, fraction = ''] = mantissa.split('.');
  const digits = BigInt(whole + fraction), shift = 3 + Number(exponent) - fraction.length;
  const scale = 10n ** BigInt(Math.abs(shift));
  const rounded = shift >= 0 ? digits * scale : (digits * 2n + scale) / (scale * 2n);
  return Number(rounded) / 1000;
}

export function dryRun(input, { ownerApproved = false } = {}) {
  if (!Array.isArray(input.menu) || !Array.isArray(input.ingredients) || !Array.isArray(input.recipes) ||
      normalize(input.menu[0]?.[0]) !== 'tên món' || normalize(input.ingredients[0]?.[0]) !== 'tên' || normalize(input.recipes[0]?.[0]) !== 'món') throw new Error('Unexpected spreadsheet structure');
  const menu = index(input.menu.slice(1)), ingredients = index(input.ingredients.slice(1));
  const blocks = [], structuralErrors = [];
  input.recipes.forEach((cells, i) => {
    if (normalize(cells[1]) !== 'nguyên liệu (*)') return;
    const hasItems = cells.slice(2, 10).some(present);
    if (!present(cells[0])) { if (hasItems) structuralErrors.push({ row: i + 1, code: 'UNNAMED_RECIPE' }); return; }
    blocks.push({ cells, i });
  });
  const duplicates = (map, kind) => [...map].filter(([, rows]) => rows.length > 1).map(([key, rows]) => ({ kind, key, rows: rows.map(row => row.row) }));
  const duplicateSources = [...duplicates(menu, 'menu'), ...duplicates(ingredients, 'ingredient')];
  const names = blocks.map(({ cells }) => normalize(cells[0]));
  const products = blocks.map(({ cells, i }) => {
    const issues = [], warnings = [], matched = menu.get(normalize(cells[0])) ?? [];
    const add = (code, detail = {}) => issues.push({ code, ...detail });
    const result = { recipeName: cells[0].trim(), recipeRow: i + 1, menuRow: matched.length === 1 ? matched[0].row : null, name: matched.length === 1 ? matched[0].cells[0] : null, price: matched.length === 1 ? matched[0].cells[1] : null, items: [], issues, warnings };
    if (names.filter(name => name === normalize(cells[0])).length > 1) add('DUPLICATE_RECIPE');
    if (matched.length !== 1) add(matched.length ? 'DUPLICATE_MENU_NAME' : 'MENU_NAME_NOT_FOUND');
    else {
      if (!Number.isSafeInteger(result.price) || result.price < 0) add('INVALID_MENU_PRICE');
      if (present(cells[11]) && cells[11] !== result.price) warnings.push({ code: 'RECIPE_PRICE_IGNORED', recipePrice: cells[11], menuPrice: result.price });
      if (normalize(matched[0].cells[2]) === 'ngừng bán') result.excludedByMenu = true;
    }
    if (normalize(input.recipes[i + 1]?.[1]) !== 'lượng dùng (*)' || normalize(input.recipes[i + 2]?.[1]) !== 'đơn vị') add('INVALID_RECIPE_BLOCK');
    const seen = new Set();
    for (let col = 2; col < 10; col++) {
      const name = cells[col], qty = input.recipes[i + 1]?.[col], rawUnit = input.recipes[i + 2]?.[col];
      if (!present(name)) { if (present(qty) || present(rawUnit)) add('UNNAMED_RECIPE_ITEM', { column: col + 1 }); continue; }
      const candidates = ingredients.get(normalize(name)) ?? [];
      const item = { ingredient: String(name).trim(), quantity: qty, sourceUnit: rawUnit ?? null, unit: unit(rawUnit, ownerApproved), ingredientRow: candidates.length === 1 ? candidates[0].row : null };
      result.items.push(item);
      if (seen.has(normalize(name))) add('DUPLICATE_RECIPE_INGREDIENT', { ingredient: item.ingredient }); seen.add(normalize(name));
      if (!decimal(qty) || qty <= 0) add('INVALID_QUANTITY', { ingredient: item.ingredient });
      if (!item.unit) add('UNSUPPORTED_RECIPE_UNIT', { ingredient: item.ingredient, unit: rawUnit ?? null });
      if (candidates.length !== 1) { add(candidates.length ? 'DUPLICATE_INGREDIENT_NAME' : 'INGREDIENT_NOT_FOUND', { ingredient: item.ingredient }); continue; }
      const n = candidates[0].cells, ingredientUnit = unit(n[7], ownerApproved);
      item.canonicalName = String(n[0]).trim();
      item.sourceUnitCost = n[8] ?? null;
      item.unitCost = ownerApproved && number(n[8]) && n[8] >= 0 ? roundUnitCost(n[8]) : (n[8] ?? null);
      if (!ingredientUnit) add('UNSUPPORTED_INGREDIENT_UNIT', { ingredient: item.ingredient, unit: n[7] ?? null });
      else if (item.unit && item.unit !== ingredientUnit) add('UNIT_MISMATCH', { ingredient: item.ingredient });
      if (!number(n[8]) || n[8] < 0 || n[8] > 1e9) add('INVALID_UNIT_COST', { ingredient: item.ingredient });
      else if (!decimal(item.unitCost)) add('UNIT_COST_PRECISION', { ingredient: item.ingredient, sourceRow: candidates[0].row });
      if (!number(n[3]) || n[3] < 0 || !number(n[6]) || n[6] <= 0) add('INVALID_INGREDIENT_PRICE_BASIS', { ingredient: item.ingredient });
      else if (number(n[8]) && Math.abs(n[3] / n[6] - n[8]) > 1e-7) add('UNIT_COST_INCONSISTENT', { ingredient: item.ingredient });
      if (!ownerApproved && normalize(name) === 'chanh' && n[8] === 0) add('ZERO_LEMON_COST_CONFIRMATION', { ingredient: item.ingredient });
      if (normalize(n[5]) === normalize(n[7]) && n[4] !== n[6]) add('PACK_YIELD_CONFIRMATION', { ingredient: item.ingredient, packaged: n[4], usable: n[6] });
    }
    if (!result.items.length) add('EMPTY_RECIPE');
    result.status = result.excludedByMenu ? 'SKIP_STOPPED' : issues.length ? 'NEEDS_CONFIRMATION' : 'READY';
    return result;
  });
  const skippedMenu = [...menu.values()].flat().filter(({ cells }) => !names.includes(normalize(cells[0]))).map(({ cells, row }) => ({ name: cells[0], row, reason: 'NO_MATCHING_RECIPE_NO_INFERENCE' }));
  return { sourceId: input.sourceId, sourceReadDate: input.readDate, sourceSha256: createHash('sha256').update(JSON.stringify(input)).digest('hex'), mode: 'OFFLINE_DRY_RUN_NO_DATABASE', ownerApprovedPolicy: ownerApproved, databaseChecked: false, duplicateSources, structuralErrors, products, skippedMenu,
    summary: { namedRecipes: products.length, ready: products.filter(p => p.status === 'READY').length, needsConfirmation: products.filter(p => p.status === 'NEEDS_CONFIRMATION').length, stopped: products.filter(p => p.status === 'SKIP_STOPPED').length, skippedMenu: skippedMenu.length },
    importGate: 'No import implemented. Real opening/minimum stock are missing; never invent quantities. Existing product API defaults may be used for optional metadata. Target DB duplicate/version checks still required before any approved import.' };
}

// Partial create fields, not permission to import. Real stock counts are absent.
export function apiPlan(result) {
  if (!result.ownerApprovedPolicy || result.duplicateSources.length || result.structuralErrors.length) throw new Error('Approved policy and unambiguous source required');
  const ingredients = new Map();
  const products = result.products.filter(p => p.status === 'READY').map(p => ({
    sourceRow: p.recipeRow, create: { name: p.name.trim(), price: p.price },
    recipe: p.items.map(item => {
      const key = `nvl-row-${item.ingredientRow}`;
      const createFields = { name: item.canonicalName ?? item.ingredient, unit: item.unit, unitCost: String(item.unitCost) };
      const old = ingredients.get(key);
      if (old && JSON.stringify(old.createFields) !== JSON.stringify(createFields)) throw new Error('Conflicting ingredient fields');
      ingredients.set(key, { key, sourceRow: item.ingredientRow, createFields, requiredBeforeCreate: ['opening', 'minimum'] });
      return { ingredientKey: key, quantity: String(item.quantity) };
    })
  }));
  return { mode: 'PREPARATION_ONLY_NO_DATABASE', sourceId: result.sourceId, sourceSha256: result.sourceSha256,
    ingredients: [...ingredients.values()], products,
    blocked: result.products.filter(p => p.status === 'NEEDS_CONFIRMATION').map(p => ({ name: p.recipeName, sourceRow: p.recipeRow, issues: p.issues })),
    note: 'Resolve ingredientKey to IDs returned by API. Recipe PATCH requires current product version. Opening/minimum are missing: do not invent real quantities. Product category/active/aliases use existing API defaults unless owner supplies values.' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (![3,4].includes(process.argv.length) || (process.argv[3] && process.argv[3] !== '--owner-approved')) { console.error('Usage: node scripts/menu-dry-run.mjs /private/path/source.json [--owner-approved]'); process.exitCode = 2; }
  else try {
    const result = dryRun(JSON.parse(await readFile(process.argv[2], 'utf8')), { ownerApproved: process.argv[3] === '--owner-approved' });
    console.log(JSON.stringify(result, null, 2));
    if (result.summary.needsConfirmation || result.duplicateSources.length || result.structuralErrors.length) process.exitCode = 2;
  } catch { console.error('Invalid local input; no database accessed.'); process.exitCode = 1; }
}

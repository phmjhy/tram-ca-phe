import test from 'node:test';
import assert from 'node:assert/strict';
import { dryRun } from '../scripts/menu-dry-run.mjs';

const fixture = () => ({ sourceId: 'TEST', readDate: '2026-11-02',
  menu: [['Tên món','Giá bán','note'],['TEST Drink',100]],
  ingredients: [['TÊN'],['TEST Ingredient',null,null,10,10,'Ml',10,'Ml',1]],
  recipes: [['MÓN'],['test drink','Nguyên liệu (*)','TEST Ingredient',null,null,null,null,null,null,null,null,99],
    [null,'Lượng dùng (*)',2],[null,'Đơn vị','Ml'],[null,'Giá vốn',2]] });
test('dry-run reads menu price, normalizes spelling only, no database action', () => {
  const r=dryRun(fixture()); assert.equal(r.summary.ready,1); assert.equal(r.products[0].price,100);
  assert.equal(r.products[0].warnings[0].code,'RECIPE_PRICE_IGNORED'); assert.equal(r.databaseChecked,false);
});
test('menu-only items do not acquire an invented recipe; stopped item excluded', () => {
  const f=fixture(); f.menu.push(['TEST Other',200]); f.menu[1][2]='ngừng bán';
  const r=dryRun(f); assert.equal(r.summary.stopped,1); assert.equal(r.skippedMenu.length,1); assert.equal(r.summary.ready,0);
});
test('duplicates in menu, ingredient catalog and recipe block are blocked', () => {
  const f=fixture(); f.menu.push([' TEST DRINK ',100]); f.ingredients.push([...f.ingredients[1]]); f.recipes.push(...f.recipes.slice(1));
  const r=dryRun(f); assert.equal(r.duplicateSources.length,2); assert.equal(r.summary.ready,0);
  assert.ok(r.products[0].issues.some(i=>i.code==='DUPLICATE_RECIPE'));
});
test('unsupported Hộp/Chai units are not converted to cái', () => {
  const f=fixture(); f.ingredients[1][7]='Hộp'; f.recipes[3][2]='Hộp';
  const r=dryRun(f); assert.equal(r.summary.ready,0); assert.equal(r.products[0].items[0].unit,null);
});
test('invalid quantities, negative cost and fractional selling price fail', () => {
  const f=fixture(); f.recipes[2][2]=0; f.ingredients[1][8]=-1; f.menu[1][1]=1.5;
  const codes=dryRun(f).products[0].issues.map(i=>i.code);
  for(const c of ['INVALID_QUANTITY','INVALID_UNIT_COST','INVALID_MENU_PRICE']) assert.ok(codes.includes(c));
});
test('cost precision is blocked instead of silently rounded, and source stays unchanged', () => {
  const f=fixture(); f.ingredients[1][8]=1.23456; const original=JSON.stringify(f);
  const r=dryRun(f); assert.ok(r.products[0].issues.some(i=>i.code==='UNIT_COST_PRECISION'));
  assert.equal(r.products[0].items[0].unitCost,1.23456); assert.equal(JSON.stringify(f),original);
});
test('missing exact name and quantity/unit mismatch are blocked', () => {
  const f=fixture(); f.menu[1][0]='TEST Drink Large'; f.recipes[3][2]='Gram';
  const codes=dryRun(f).products[0].issues.map(i=>i.code);
  assert.ok(codes.includes('MENU_NAME_NOT_FOUND')); assert.ok(codes.includes('UNIT_MISMATCH'));
});

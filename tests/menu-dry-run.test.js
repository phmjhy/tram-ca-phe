import test from 'node:test';
import assert from 'node:assert/strict';
import { dryRun, roundUnitCost, apiPlan } from '../scripts/menu-dry-run.mjs';

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
test('approved decimal half-up handles ties without binary floating point rounding', () => {
  assert.equal(roundUnitCost(116.6665),116.667);
  assert.equal(roundUnitCost(1.0055),1.006);
  assert.equal(roundUnitCost(52.63157894736842),52.632);
  assert.equal(roundUnitCost(9416.666666666666),9416.667);
  assert.equal(roundUnitCost(0.0005),0.001);assert.equal(roundUnitCost(0),0);
});
test('approved count units and rounding keep quantity and source unchanged', () => {
  const f=fixture();f.ingredients[1][3]=12.345;f.ingredients[1][8]=1.2345;
  f.ingredients[1][5]='Hộp';f.ingredients[1][7]='Hộp';f.recipes[3][2]='Hộp';
  const original=JSON.stringify(f),r=dryRun(f,{ownerApproved:true});
  assert.equal(r.summary.ready,1);assert.equal(r.products[0].items[0].unit,'cái');
  assert.equal(r.products[0].items[0].quantity,2);assert.equal(r.products[0].items[0].unitCost,1.235);
  assert.equal(JSON.stringify(f),original);
});
test('approved zero lemon cost is allowed, physical units still cannot be inferred', () => {
  const f=fixture();f.ingredients[1][0]='chanh';f.recipes[1][2]='chanh';f.ingredients[1][3]=0;f.ingredients[1][8]=0;
  assert.equal(dryRun(f,{ownerApproved:true}).summary.ready,1);
  f.recipes[3][2]='Gram';assert.equal(dryRun(f,{ownerApproved:true}).summary.ready,0);
});
test('S2 approved 65000 / 50 = 1300 each, 2 per portion, price 5000', () => {
  const f=fixture();f.menu[1]=['xúc xích s2',5000];f.recipes[1][0]='xúc xích s2';f.recipes[1][2]='xúc xích s2';
  f.ingredients[1]=['xúc xích s2',null,'Hộp',65000,50,'Cái',50,'Cái',1300];f.recipes[3][2]='Cái';
  const p=dryRun(f,{ownerApproved:true}).products[0];assert.equal(p.status,'READY');assert.equal(p.price,5000);
  assert.equal(p.items[0].quantity*p.items[0].unitCost,2600);
});
test('API plan excludes unmatched/stopped and leaves real stock fields unresolved', () => {
  const f=fixture();f.recipes.push(['TEST Missing','Nguyên liệu (*)','TEST Ingredient'],[null,'Lượng dùng (*)',1],[null,'Đơn vị','Ml']);
  const plan=apiPlan(dryRun(f,{ownerApproved:true}));assert.equal(plan.products.length,1);assert.equal(plan.blocked.length,1);
  assert.deepEqual(plan.ingredients[0].requiredBeforeCreate,['opening','minimum']);
  assert.equal('opening' in plan.ingredients[0].createFields,false);
});
test('stable import keys survive inserted sheet rows and missing stock remains unresolved',()=>{
 const first=fixture(),second=fixture();second.ingredients.splice(1,0,[]);second.recipes.splice(1,0,[]);
 const a=apiPlan(dryRun(first,{ownerApproved:true})),b=apiPlan(dryRun(second,{ownerApproved:true}));
 assert.equal(a.ingredients[0].key,b.ingredients[0].key);assert.equal(a.products[0].key,b.products[0].key);
 assert.notEqual(a.ingredients[0].sourceRow,b.ingredients[0].sourceRow);assert.equal('minimum' in a.ingredients[0].createFields,false);
});

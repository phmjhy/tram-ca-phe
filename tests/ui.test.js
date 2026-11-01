import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {transformSync} from 'esbuild';
import * as domain from '../src/domain.js';
const cache={react:React,'./api-client.js':{request:()=>{throw new Error('SSR must not fetch');}},'./domain.js':domain};
function load(name){if(cache[name])return cache[name];const module={exports:{}};const code=transformSync(fs.readFileSync(new URL('../src/'+name.replace('./',''),import.meta.url),'utf8'),{loader:'jsx',format:'cjs'}).code;vm.runInNewContext(code,{module,require:load,crypto:{randomUUID:()=> 'TEST'},sessionStorage:{getItem:()=>null}});return cache[name]=module.exports;}
const {CafeApp,matches}=load('./CafeApp.jsx');
const markup=role=>renderToStaticMarkup(React.createElement(CafeApp,{user:{id:'TEST',role,name:'TEST'},onLogout:()=>{},onSessionExpired:()=>{}}));
test('search normalizes accents, alias, cafe and keyboard-friendly name matching',()=>{const p={name:'Cà phê',aliases:'coffee'};for(const q of ['cafe','ca phe','CÀ PHÊ','coffee'])assert.equal(matches(p,q),true);assert.equal(matches(p,'trà'),false);});
test('STAFF nav has only Sales and Shifts, no business costs or channels',()=>{const html=markup('staff'),nav=html.match(/<nav.*?<\/nav>/)[0];assert.match(nav,/Bán hàng/);assert.match(nav,/Ca làm/);assert.doesNotMatch(nav,/Dashboard|Kho|Chi phí|Nhân viên/);assert.doesNotMatch(html,/GrabFood|ShopeeFood|Hotline|Mang đi|Pha chế|Tiền mặt|Chuyển khoản|Phí ship|TC-/);});
test('OWNER has exactly five required navigation actions',()=>{const nav=markup('owner').match(/<nav.*?<\/nav>/)[0];for(const t of ['Bán hàng','Dashboard','Kho &amp; Menu','Chi phí','Nhân viên'])assert.ok(nav.includes(t));assert.equal((nav.match(/<button/g)||[]).length,5);});
test('sale has labeled search, paid checkbox and Save disabled before server sync',()=>{const html=markup('staff');assert.match(html,/Tìm món/);assert.match(html,/type="checkbox"/);assert.match(html,/Đã thanh toán/);assert.match(html,/<button class="primary save-sale" disabled="">Lưu/);});

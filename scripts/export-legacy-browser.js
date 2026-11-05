// Owner runs this on EACH old device/browser at the old site's origin.
// Read/download only. Never sends data or changes storage. Keep download private.
(() => {
  const entries=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(['tram_products','tram_orders','tram_products_v2'].includes(key)||key?.startsWith('tram_order_v2:'))entries.push({key,raw:localStorage.getItem(key)});
  }
  entries.sort((a,b)=>a.key.localeCompare(b.key));
  const snapshot={format:'tram-legacy-export-v1',origin:location.origin,exportedAt:new Date().toISOString(),entries};
  const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='tram-legacy-'+Date.now()+'.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
})();

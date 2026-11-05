import { serve } from '../server/http.js';
import { getApp } from '../server/runtime.js';
await serve(request=>getApp()(request),{port:Number(process.env.PORT||4176)});
console.log('POS server listening on loopback.');

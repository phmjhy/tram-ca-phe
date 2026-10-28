import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
export function serve(app,{port=4176,host='127.0.0.1',dist='dist'}={}) {
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,`http://${host}:${port}`);
   if(url.pathname.startsWith('/api/')){
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const request=new Request(url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await app(request);res.statusCode=response.status;
    for(const [key,value]of response.headers)if(key!=='set-cookie')res.setHeader(key,value);
    const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
    res.end(Buffer.from(await response.arrayBuffer()));return;
   }
   const relative=decodeURIComponent(url.pathname).replace(/^\/+/, '');const root=path.resolve(dist);let file=path.resolve(root,relative||'index.html');
   if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403);res.end();return;}
   let bytes;try{bytes=await readFile(file);}catch{if(path.extname(file)){res.writeHead(404);res.end();return;}file=path.join(root,'index.html');bytes=await readFile(file);}
   const type={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(bytes);
  }catch{res.writeHead(500);res.end('Request failed');}
 });return new Promise(resolve=>server.listen(port,host,()=>resolve(server)));
}

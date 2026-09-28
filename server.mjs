import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||4173);
http.createServer(async(req,res)=>{try{
const url=new URL(req.url,'http://localhost');
if(url.pathname==='/__pixel-forge/omarchy-colors'){
  const home=process.env.HOME||'';
  const colorsPath=path.join(home,'.local','state','omarchy','current','theme','colors.toml');
  const body=await readFile(colorsPath,'utf8');
  res.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
  res.end(body);
  return;
}
const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root))throw Error();const body=await readFile(file);res.writeHead(200,{'Content-Type':({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json'})[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(404);res.end('Not found');}}).listen(port,host,()=>console.log(`Pixel Forge → http://${host}:${port}`));

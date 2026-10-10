'use strict';
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),pathname=url.pathname;
    if(pathname.startsWith('/api/')){
      const name=pathname.replace(/^\/api\//,'');
      if(!/^[a-z-]+$/.test(name)){res.writeHead(404).end();return;}
      const fn=require(path.join(ROOT,'api',name+'.js'));
      req.query=Object.fromEntries(url.searchParams);
      const chunks=[];for await(const chunk of req){chunks.push(chunk);if(chunks.reduce((x,b)=>x+b.length,0)>10000)throw Error('Request too large')}
      if(chunks.length)req.body=JSON.parse(Buffer.concat(chunks).toString('utf-8'));
      res.status=function(code){this.statusCode=code;return this;};
      res.send=function(data){this.end(data);return this;};
      res.json=function(data){this.setHeader('Content-Type','application/json');this.end(JSON.stringify(data));return this;};
      await fn(req,res);return;
    }
    const file=path.resolve(ROOT,'.'+(pathname==='/'?'/index.html':pathname));
    if(!(file===ROOT||file.startsWith(ROOT+path.sep)))throw Error('Bad path');
    const data=await fs.readFile(file);
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  }catch(e){if(!res.headersSent){res.statusCode=404;res.end('Not found');}}
}).listen(Number(process.env.PORT||4173),'127.0.0.1',()=>console.log('Leaflight local test server ready'));

#!/usr/bin/env python3
"""QA 独立的 Cloudflare Pages 模拟器（不用程序员的 serve_pages.mjs）。
- /index.html -> 308 /, /credits.html -> 308 /credits（保留 query）；/credits 服 credits.html
- 读 <root>/_headers 套用 header；MIME 含 webp
- 根目录可热切换：POST 不支持，改为读环境 ROOT_FILE 指向的文件内容（每次请求读取），用于模拟版本升级
用法: pages_server.py PORT ROOT_FILE
"""
import http.server, os, sys, re, mimetypes, urllib.parse
PORT=int(sys.argv[1]); ROOT_FILE=sys.argv[2]
MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml',
 '.png':'image/png','.webp':'image/webp','.csv':'text/csv; charset=utf-8'}
REDIR={'/index.html':'/','/credits.html':'/credits'}
def headers_rules(root):
    p=os.path.join(root,'_headers'); rules=[]; cur=None
    if not os.path.exists(p): return rules
    for line in open(p,encoding='utf8'):
        if not line.strip(): continue
        if not line[0].isspace(): cur=(line.strip(),[]); rules.append(cur)
        elif cur and ':' in line: k,v=line.strip().split(':',1); cur[1].append((k.strip(),v.strip()))
    return rules
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def do_GET(self):
        root=open(ROOT_FILE).read().strip()
        u=urllib.parse.urlsplit(self.path); path=urllib.parse.unquote(u.path)
        if path in REDIR:
            self.send_response(308); self.send_header('Location',REDIR[path]+('?'+u.query if u.query else '')); self.end_headers(); return
        if path=='/': f='index.html'
        elif path=='/credits': f='credits.html'
        else: f=path.lstrip('/')
        fp=os.path.normpath(os.path.join(root,f))
        if not fp.startswith(root) or not os.path.isfile(fp) or os.path.basename(fp)=='_headers':
            self.send_response(404); self.send_header('content-type','text/plain'); self.end_headers(); self.wfile.write(b'404'); return
        data=open(fp,'rb').read()
        self.send_response(200); self.send_header('content-type',MIME.get(os.path.splitext(fp)[1],'application/octet-stream'))
        self.send_header('content-length',str(len(data)))
        for pat,hs in headers_rules(root):
            if re.fullmatch(re.escape(pat).replace(r'\*','.*'),path):
                for k,v in hs: self.send_header(k,v)
        self.end_headers(); self.wfile.write(data)
http.server.ThreadingHTTPServer(('127.0.0.1',PORT),H).serve_forever()

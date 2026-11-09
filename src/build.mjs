// 拼装单文件：src/ 各部分 + lib/leaflet → index.html（或指定输出路径）
// 用法：node src/build.mjs [输出文件]   （缺省输出到仓库根 index.html）
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const read = f => readFileSync(join(dir, f), 'utf8');

let html = read('shell.html');
// 用 split/join 避免 replace 对 $ 符号的特殊解释（leaflet.min.js 里大量 $）
const inject = (ph, content) => { html = html.split(ph).join(content); };

inject('__LEAFLET_CSS__', read('../lib/leaflet.css'));
inject('__APP_CSS__', read('app.css'));
inject('__LEAFLET_JS__', read('../lib/leaflet.js'));
inject('__DATA__', read('data.js'));
inject('__ENGINE__', read('engine.js'));

const out = process.argv[2] ? resolve(process.argv[2]) : join(dir, '..', 'index.html');
writeFileSync(out, html);
console.log('OK ->', out, (html.length / 1024).toFixed(1) + ' KB');

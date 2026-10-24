import { readFileSync, writeFileSync } from 'node:fs';
const f = 'C:/SICA/.tools/append-g2b.mjs';
let s = readFileSync(f, 'utf8');
const re = /arr\.join\('[\s\S]{0,4}'\), 'utf8'\);/;
const ok = re.test(s);
s = s.replace(re, "arr.join(String.fromCharCode(10)), 'utf8');");
writeFileSync(f, s);
console.log('fixed:', ok);

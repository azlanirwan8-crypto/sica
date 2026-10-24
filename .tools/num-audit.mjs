import { readFileSync } from 'node:fs';

const file = process.argv[2];
const re = process.argv[3] ? new RegExp(process.argv[3], 'g') : /^\| ([0-9]+) \| `/g;
const s = readFileSync(file, 'utf8');
const nums = [];
let m;
while ((m = re.exec(s)) !== null) nums.push(Number(m[1]));
nums.sort((a, b) => a - b);
const set = new Set(nums);
const dup = nums.filter((n, i) => i && nums[i - 1] === n);
const gaps = [];
if (nums.length) {
  for (let i = nums[0]; i <= nums[nums.length - 1]; i++) if (!set.has(i)) gaps.push(i);
}
console.log(`count=${nums.length} distinct=${set.size} min=${nums[0]} max=${nums[nums.length - 1]}`);
console.log(`duplikat=${dup.length ? dup.join(',') : '0'}`);
console.log(`lubang=${gaps.length ? gaps.slice(0, 40).join(',') : '0'} (${gaps.length})`);

// Dev codemod: physical Tailwind classes -> logical ones so layouts mirror in RTL.
import fs from 'fs';
const B = `(?<=[\\s'"\`{(])`;
const rules = [
  [new RegExp(`${B}(-?)m([lr])-`, 'g'), (_, n, s) => `${n}m${s === 'l' ? 's' : 'e'}-`],
  [new RegExp(`${B}(-?)p([lr])-`, 'g'), (_, n, s) => `${n}p${s === 'l' ? 's' : 'e'}-`],
  [new RegExp(`${B}(-?)left-(?!1/2)`, 'g'), (_, n) => `${n}start-`],
  [new RegExp(`${B}(-?)right-(?!1/2)`, 'g'), (_, n) => `${n}end-`],
  [new RegExp(`${B}text-left(?![\\w-])`, 'g'), () => 'text-start'],
  [new RegExp(`${B}text-right(?![\\w-])`, 'g'), () => 'text-end'],
  [new RegExp(`${B}border-l(?=[\\s'"\`-]|$)`, 'g'), () => 'border-s'],
  [new RegExp(`${B}border-r(?=[\\s'"\`-]|$)`, 'g'), () => 'border-e'],
  [new RegExp(`${B}rounded-r(?=[\\s'"\`-]|$)`, 'g'), () => 'rounded-e'],
  [new RegExp(`${B}rounded-l(?=[\\s'"\`-]|$)`, 'g'), () => 'rounded-s'],
];
for (const f of process.argv.slice(2)) {
  let s = fs.readFileSync(f, 'utf8');
  let n = 0;
  for (const [re, fn] of rules) s = s.replace(re, (...a) => (n++, fn(...a)));
  if (n) {
    fs.writeFileSync(f, s);
    console.log(`${n}\t${f}`);
  }
}

// scripts/generate.ts
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const N = Number(process.argv[2] ?? 400);

// 出力先
const outDirType = resolve("src/type-version");
const outDirIface = resolve("src/interface-version");
mkdirSync(outDirType, { recursive: true });
mkdirSync(outDirIface, { recursive: true });

// ---- 交差型（type &）版 ----
{
  const parts: string[] = [];
  parts.push(`// generated: ${N} blocks (type intersections)\n`);
  for (let i = 0; i < N; i++) {
    parts.push(
      `type A${i} = { k${i}_a?: string; k${i}_b?: number; k${i}_c?: boolean }`
    );
  }
  parts.push(
    `\nexport type Mega = ` +
      Array.from({ length: N }, (_, i) => `A${i}`).join(" & ") +
      `;`
  );
  parts.push(
    `\nexport type ButtonBaseProps = React.ButtonHTMLAttributes<HTMLButtonElement>`
  );
  parts.push(`export type IconProps = { icon: React.ReactNode }`);
  parts.push(`export type HugeProps = ButtonBaseProps & IconProps & Mega`);

  writeFileSync(resolve(outDirType, "generated.types.ts"), parts.join("\n"));

  const comp = `// src/type-version/Component.tsx
import React from 'react'
import type { HugeProps } from './generated.types'

export function Component(p: HugeProps) {
  return <button {...p}>{p.icon}</button>
}
`;
  writeFileSync(resolve(outDirType, "Component.tsx"), comp);
}

// ---- interface（extends）版 ----
{
  const parts: string[] = [];
  parts.push(`// generated: ${N} blocks (interface extends)\n`);
  for (let i = 0; i < N; i++) {
    const parent = i === 0 ? "" : ` extends I${i - 1}`;
    parts.push(
      `export interface I${i}${parent} { k${i}_a?: string; k${i}_b?: number; k${i}_c?: boolean }`
    );
  }
  parts.push(`\nexport interface Mega extends I${N - 1} {}`);
  parts.push(
    `export interface ButtonBaseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}`
  );
  parts.push(`export interface IconProps { icon: React.ReactNode }`);
  parts.push(
    `export interface HugeProps extends ButtonBaseProps, IconProps, Mega {}`
  );

  writeFileSync(
    resolve(outDirIface, "generated.interfaces.ts"),
    parts.join("\n")
  );

  const comp = `// src/interface-version/Component.tsx
import React from 'react'
import type { HugeProps } from './generated.interfaces'

export function Component(p: HugeProps) {
  return <button {...p}>{p.icon}</button>
}
`;
  writeFileSync(resolve(outDirIface, "Component.tsx"), comp);
}

console.log(`[gen] generated ${N} blocks for type & interface variants`);

// src/interface-version/Component.tsx
import React from 'react'
import type { HugeProps } from './generated.interfaces'

export function Component(p: HugeProps) {
  return <button {...p}>{p.icon}</button>
}

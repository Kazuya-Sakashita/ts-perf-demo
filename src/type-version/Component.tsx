// src/type-version/Component.tsx
import React from 'react'
import type { HugeProps } from './generated.types'

export function Component(p: HugeProps) {
  return <button {...p}>{p.icon}</button>
}

import type { cross, dot, select } from 'three/tsl'

/**
 * The three node types the box's shaders pass around. TSL names a node after
 * the expression that made it, so these aliases are taken off functions with
 * one signature each: whatever `dot` returns is a float, whatever `cross`
 * returns is a vec3, and whatever `select` tests is a bool.
 */
export type FloatNode = ReturnType<typeof dot>
export type Vec3Node = ReturnType<typeof cross>
export type BoolNode = Parameters<typeof select>[0]

import { FURNITURE_PROPS, type FurnitureProp } from '@gb/world'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { CELL, FURNISH_STYLES, PROP_SPECS, footprintOf } from '../src/index.ts'
import { backwardsMass, boundsOf, dressingIn, padAt, sizeOf } from './support.ts'

/**
 * The other half of the contract with `@gb/forge`: a prop is a rectangle of
 * 10 cm room cells and it stays inside them.
 *
 * The planner claims those cells, so anything that reaches past them, a handle,
 * a leaf of a plant, the corner of a backrest, would stand in a walkway or in
 * the piece beside it however careful the placement was.
 */

/** A tenth of a millimetre: what a float32 buffer costs, well under a cell. */
const SLACK = 1e-4

/**
 * Boots to crown, of the body `@gb/cast` lays on a bed: its lying clip is
 * centred on its own root and reaches 0.96 m either way, on all twelve dressed
 * characters. A mattress shorter than this leaves a sleeper hanging off it.
 */
const LYING_BODY = 2 * 0.96

describe('the floor a prop claims', () => {
  it('is a whole number of 10 cm cells for every prop, because that is what the planner claims', () => {
    for (const prop of FURNITURE_PROPS) {
      const [across, deep] = PROP_SPECS[prop].cells
      expect(Number.isInteger(across), `${prop} across`).toBe(true)
      expect(Number.isInteger(deep), `${prop} deep`).toBe(true)
      expect(across, `${prop} across`).toBeGreaterThan(0)
      expect(deep, `${prop} deep`).toBeGreaterThan(0)
      expect(footprintOf(prop).width).toBeCloseTo(across * CELL, 10)
    }
  })

  it('holds the whole prop, in both languages, with nothing hanging over the edge', () => {
    for (const style of FURNISH_STYLES) {
      const dressing = dressingIn(style)
      for (const prop of FURNITURE_PROPS) {
        const { width, depth } = footprintOf(prop)
        const bounds = boundsOf(dressing.prop(prop))

        expect(bounds.max.x, `${style} ${prop} right`).toBeLessThanOrEqual(width / 2 + SLACK)
        expect(bounds.min.x, `${style} ${prop} left`).toBeGreaterThanOrEqual(-width / 2 - SLACK)
        expect(bounds.max.z, `${style} ${prop} back`).toBeLessThanOrEqual(depth / 2 + SLACK)
        expect(bounds.min.z, `${style} ${prop} front`).toBeGreaterThanOrEqual(-depth / 2 - SLACK)
      }
    }
  })

  it('is filled rather than rattling around in: a prop uses the cells it took', () => {
    for (const prop of FURNITURE_PROPS) {
      const { width, depth } = footprintOf(prop)
      const size = sizeOf(dressingIn('corpo').prop(prop))

      expect(size.x / width, `${prop} across`).toBeGreaterThan(0.85)
      expect(size.z / depth, `${prop} deep`).toBeGreaterThan(0.85)
    }
  })

  it('stands on the floor with its origin at the centre of its base', () => {
    for (const style of FURNISH_STYLES) {
      for (const prop of FURNITURE_PROPS) {
        const bounds = boundsOf(dressingIn(style).prop(prop))
        expect(bounds.min.y, `${style} ${prop} on the floor`).toBeCloseTo(0, 5)
        expect(Math.abs(bounds.getCenter(new THREE.Vector3()).x), `${style} ${prop} centred`).toBeLessThan(0.005)
      }
    }
  })

  it('is exactly as tall as it says, for the pieces nobody touches', () => {
    for (const style of FURNISH_STYLES) {
      for (const [prop, spec] of Object.entries(PROP_SPECS) as [FurnitureProp, (typeof PROP_SPECS)[FurnitureProp]][]) {
        if (spec.height === undefined) continue
        expect(sizeOf(dressingIn(style).prop(prop)).y, `${style} ${prop} tall`).toBeCloseTo(spec.height, 5)
      }
    }
  })

  it('claims enough of it for a whole body to lie on the bed', () => {
    // the mattress is the length, not the anchor: centring a sleeper on the pad
    // only shares the overhang out between the head and the foot
    for (const style of FURNISH_STYLES) {
      const [front, back] = padAt(dressingIn(style).prop('bed'), PROP_SPECS.bed.contact!.height)
      expect(back - front, `${style} mattress`).toBeGreaterThanOrEqual(LYING_BODY)
    }
  })

  it('turns everything with a back to it so its front looks north', () => {
    // a chair, a sofa and a bed carry their upper half behind them: the backrest, the headboard
    for (const style of FURNISH_STYLES) {
      for (const prop of ['chair', 'office-chair', 'sofa', 'bed'] as const) {
        expect(backwardsMass(dressingIn(style).prop(prop)), `${style} ${prop}`).toBeGreaterThan(0.02)
      }
    }
  })
})

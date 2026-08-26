/**
 * Every clip authored in this repo, in build order: a spec may build on any
 * clip above it. Standing first because the relaxed stance is the base the
 * working and seated clips borrow from.
 */
import { SEATED } from './seated.mjs'
import { STANDING } from './standing.mjs'
import { WALKING } from './walking.mjs'
import { WORKING } from './working.mjs'

export const AUTHORED = [...STANDING, ...WORKING, ...SEATED, ...WALKING]

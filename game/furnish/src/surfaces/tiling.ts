import type * as THREE from 'three'

/**
 * Lays a material's texture out by where the surface is in the world, in
 * metres, instead of by the mesh's own UVs.
 *
 * @gb/scene builds a room out of a plane for the floor and a box per wall, and
 * both of those carry UVs that run 0..1 across the whole thing. A shared
 * material cannot tile off that: one texture would stretch over a whole room,
 * and a small room and a large one would show flagstones of different sizes.
 * Reading the world position in the vertex shader instead gives every surface
 * in the building the same real-world scale, and no seam where one wall meets
 * the next.
 *
 * The projection is picked per face from the world normal: floors and ceilings
 * take x and z, walls take height for v and whichever horizontal axis they run
 * along for u. `mapTransform` still applies, so `texture.repeat = 1 / metres`
 * sets the tile size the way it does anywhere else.
 */
const PROJECT = /* glsl */ `
#include <uv_vertex>
	vec3 gbWorld = ( modelMatrix * vec4( position, 1.0 ) ).xyz;
	vec3 gbFace = abs( normalize( mat3( modelMatrix ) * normal ) );
	vec2 gbPlanar = gbFace.y > max( gbFace.x, gbFace.z )
		? gbWorld.xz
		: ( gbFace.x > gbFace.z ? vec2( gbWorld.z, gbWorld.y ) : vec2( gbWorld.x, gbWorld.y ) );
	#ifdef USE_MAP
		vMapUv = ( mapTransform * vec3( gbPlanar, 1 ) ).xy;
	#endif
	#ifdef USE_NORMALMAP
		vNormalMapUv = ( normalMapTransform * vec3( gbPlanar, 1 ) ).xy;
	#endif
`

/** Shared, so every surface in the town compiles one program between them. */
function project(shader: { vertexShader: string }): void {
  shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', PROJECT)
}

export function worldTiled<T extends THREE.Material>(material: T): T {
  material.onBeforeCompile = project
  return material
}

/** Whether a material has the projection on it. What the tests ask, and what a renderer never needs to. */
export function isWorldTiled(material: THREE.Material): boolean {
  return material.onBeforeCompile === project
}

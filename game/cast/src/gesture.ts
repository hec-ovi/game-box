import * as THREE from 'three'

/**
 * The bones a gesture is allowed to touch. Anything from the waist down keeps
 * doing what the base clip says, so somebody can talk with their hands while
 * sitting, leaning or walking.
 */
const UPPER = /^(spine_|neck_|Head|clavicle_|upperarm_|lowerarm_|hand_|index_|middle_|pinky_|ring_|thumb_)/

/**
 * Cuts a clip down to the upper body and makes it additive, so it can be
 * layered over a base clip instead of replacing it. The reference pose is the
 * clip's own first frame, which is what turns the clip into "the movement it
 * adds" rather than "the pose it holds".
 */
export function upperBodyOf(clip: THREE.AnimationClip): THREE.AnimationClip | undefined {
  const tracks = clip.tracks.filter((track) => UPPER.test(boneOf(track.name)))
  if (!tracks.length) return undefined
  const masked = new THREE.AnimationClip(
    `${clip.name}#upper`,
    clip.duration,
    tracks.map((track) => track.clone()),
  )
  THREE.AnimationUtils.makeClipAdditive(masked)
  return masked
}

/** `Armature/Head.quaternion` and `Head.quaternion` both name the bone `Head`. */
function boneOf(trackName: string): string {
  const property = trackName.split('.')[0] ?? ''
  return property.split('/').pop() ?? ''
}

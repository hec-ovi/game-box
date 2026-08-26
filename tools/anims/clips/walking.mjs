/**
 * Walking down the street.
 *
 * The two packs hold one walk cycle between them. `Walk_Formal_Loop` shares
 * `Walk_Loop`'s legs frame for frame (both 1.33 s, the same 0.65 m stride, the
 * feet forwardmost at the same moment) and differs only in that its arms are
 * pinned: 2.6 degrees of shoulder against 32.8, less than a body standing
 * still, which is why it reads as a broken person rather than a different one.
 *
 * So a street's variety is carriage, not a second cycle: the same walk carried
 * a different way. Each of these holds `Walk_Loop`'s own swing and its own
 * legs, and changes how the body is held over them. Angles are degrees about
 * the character's own axes, see tools/anims/derive.mjs.
 */
export const WALKING = [
  {
    name: 'Walk_Loose_Loop',
    from: 'Walk_Loop',
    what: 'walking loose-limbed: chest open, arms swinging clear of the ribs, elbows long',
    turn: {
      spine_02: { back: 4 },
      upperarm_l: { roll: -9 },
      upperarm_r: { roll: 9 },
      lowerarm_l: { back: -14 },
      lowerarm_r: { back: -14 },
      Head: { back: -2 },
    },
  },
  {
    name: 'Walk_Brisk_Loop',
    from: 'Walk_Loop',
    what: 'walking somewhere: leaning into it, elbows bent, hands driving in front of the hips',
    turn: {
      spine_01: { back: -6 },
      spine_02: { back: -4 },
      neck_01: { back: 7 },
      Head: { back: 4 },
      upperarm_l: { roll: -3 },
      upperarm_r: { roll: 3 },
      lowerarm_l: { back: 45 },
      lowerarm_r: { back: 45 },
    },
  },
]

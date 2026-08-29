import type { CastPart, InstanceCasting, InstancePost } from '@gb/forge'

/**
 * What one job wants of one post, in the words the place prompt reads. The job
 * is named by its kind and never by its title: a title is prose the model could
 * hang over this very door, and which job it is changes nothing about the person
 * standing there.
 */
const WANTED: Record<CastPart, (job: string) => string> = {
  giver: (job) => `hands ${job} out`,
  'talk-to': (job) => `${job} sends the player to them to talk`,
  'deliver-to': (job) => `${job} has the player bring them something`,
  'walk-with': (job) => `${job} asks them to walk somewhere with the player`,
}

/**
 * The posts to fill, each with what the town's work already needs of it.
 *
 * The quests are written before anybody is, against the posts the plan cut, so
 * some of these posts are already somebody a job names. Saying so on the post's
 * own line is what makes the person written into it the person the player finds
 * at that door, rather than a stranger the job happens to point at.
 */
export function postLines(posts: readonly InstancePost[], cast: readonly InstanceCasting[]): readonly string[] {
  return posts.map((post) => {
    const work = [
      ...new Set(cast.filter((one) => one.postId === post.postId).map((one) => WANTED[one.part](job(one.questKind)))),
    ]
    return [`${post.postId}: the ${post.role}`, ...work].join('; ')
  })
}

const job = (kind: InstanceCasting['questKind']): string => (kind === 'main' ? 'the main job' : 'a side job')

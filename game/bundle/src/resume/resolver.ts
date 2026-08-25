import type { QuestDoc } from '@gb/quest'
import { questView, type World } from '@gb/world'

/** What the names in a save resolve to in the city it is being opened in. */
export class Resolver {
  private readonly view: ReturnType<typeof questView>
  private readonly quests: ReadonlyMap<string, QuestDoc>
  private readonly titles: Readonly<Record<string, string>>

  /** `titles` is what the save recorded each quest as, so a rebuilt city's reuse of an id is caught. */
  constructor(world: World, quests: readonly QuestDoc[], titles: Readonly<Record<string, string>>) {
    this.view = questView(world)
    this.quests = new Map(quests.map((quest) => [quest.id, quest]))
    this.titles = titles
  }

  hasItem(id: string): boolean {
    return this.view.hasItem(id)
  }

  hasNpc(id: string): boolean {
    return this.view.hasNpc(id)
  }

  hasInterior(id: string): boolean {
    return this.view.hasInterior(id)
  }

  hasAnchor(interiorId: string, anchorId: string): boolean {
    return this.view.hasAnchor(interiorId, anchorId)
  }

  /**
   * The quest the save meant. Ids are minted in order, so a rebuilt city hands
   * `quest_0001` to whatever it wrote first; the title the save recorded tells
   * that quest from this one. A save with no titles resolves by id alone.
   */
  quest(id: string): QuestDoc | undefined {
    const quest = this.quests.get(id)
    const title = this.titles[id]
    return quest && (title === undefined || quest.title === title) ? quest : undefined
  }

  hasQuest(id: string): boolean {
    return this.quest(id) !== undefined
  }
}

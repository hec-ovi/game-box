/** One reason a schema-valid quest was refused, pointed at the step or the quest it is about. */
export interface QuestProblem {
  readonly where: string
  readonly message: string
}

/** Collects problems while a check walks a quest. */
export type Report = (where: string, message: string) => void

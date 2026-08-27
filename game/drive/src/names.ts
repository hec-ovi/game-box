/**
 * What the prompt calls a car. The pack names its models after files; the
 * player reads a sentence, so a `SportsCar2` is a sports car. Anything not
 * listed is a car, which is what a new model in the pack should read as until
 * somebody gives it a better word.
 */
const NAMES: Record<string, string> = {
  SUV: 'SUV',
  Taxi: 'taxi',
  SportsCar: 'sports car',
  SportsCar2: 'sports car',
  Cop: 'police car',
  GranTurismo: 'coupe',
  Concept: 'concept car',
  Patrol: 'patrol car',
}

export function nameOf(model: string): string {
  return NAMES[model] ?? 'car'
}

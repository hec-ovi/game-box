/**
 * The cars the traffic pack ships, one node each in `cars.glb`. A quest that
 * rewards a car names one of these, so a reward is always a car the game can
 * draw.
 */
export const CAR_MODELS = ['NormalCar1', 'NormalCar2', 'SUV', 'Taxi', 'SportsCar', 'SportsCar2', 'Cop', 'GranTurismo', 'Concept', 'Patrol'] as const

export type CarModel = (typeof CAR_MODELS)[number]

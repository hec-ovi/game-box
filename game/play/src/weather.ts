/** What the sky is doing. Closed set: the renderer has a look for each of these and nothing else. */
export const WEATHERS = ['clear', 'overcast', 'rain'] as const

export type Weather = (typeof WEATHERS)[number]

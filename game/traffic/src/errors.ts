/** Everything this box can refuse, and nothing else. */
export type TrafficError =
  | { readonly code: 'broken-graph'; readonly message: string }
  | { readonly code: 'no-lanes'; readonly message: string }

# @gb/providers contract

contractVersion: 0.1.0

## Purpose

The client for the AI service's provider endpoints: read how the model services are set up, write it back, and ask one of them whether it is there, what it can run, and what it actually answers.

## Inputs

| Param | Schema | Preconditions |
|---|---|---|
| `new Providers(options?)` | `base?`, `fetch?`, `timeouts?` | `base` defaults to `GAME_BOX_URL` or `http://127.0.0.1:8976`; `fetch` is injectable, so this runs in a browser, in Node and in a test; `timeouts` sets this client's defaults |
| `configuration(ask?)` | `signal?`, `timeoutMs?` | reads `GET /v1/providers` |
| `save(edit, ask?)` | [Save](src/schema.ts), plus `signal?` and `timeoutMs?` | `providers` and `routes` are each optional and each replace the whole of their side; a provider's `secret` left out keeps the stored key and an empty one clears it; every route must name a provider in the same body |
| `health(id, ask?)` | provider id, plus `signal?` and `timeoutMs?` | one listing call at the provider, no generation |
| `test(id, ask?)` | the same | one real generation through the provider |
| `models(id, ask?)` | the same | what the provider lists |
| `editable(configuration)` | a `Configuration` | the same providers with the service's own readings taken off, ready to change a field on and send back |

Every call takes the caller's own `AbortSignal` and runs against a clock: `askMs` (20 s) for reading, writing, `health` and `models`, and `testMs` (300 s) for `test`, which is a whole generation. Either is overridable per call with `timeoutMs`.

## Outputs

| Param | Schema | Postconditions |
|---|---|---|
| `configuration`, `save` | `Result<Configuration, ProvidersError>` | every provider, whether each is ready for a job, whether each key is set, and the routing |
| `health` | `Result<Health, ProvidersError>` | the verdict, whether the key is set, the status it answered with, and the milliseconds |
| `test` | `Result<Tested, ProvidersError>` | `ok` carries what the model wrote, the model that answered and the milliseconds; any other verdict carries why |
| `models` | `Result<Models, ProvidersError>` | what it lists, each with the name it gave where it gave one |

A provider is `external` (a hosted service reached with a key: a base URL, a model, and the name the key is stored under) or `local` (an OpenAI-compatible server of your own: a host, a port and a model, never sent a credential).

A verdict is `ok` (it answered), `unreachable` (nothing answered), `refused` (it answered no, so a wrong key or a model the account may not use), `busy` (rate-limited) or `misconfigured` (it was never asked, because its settings are incomplete). A verdict is data, not a failure: bad news about a provider arrives as a value.

The five jobs a provider can be pointed at are `history`, `city`, `places`, `quests` and `dialogs`, and `JOBS` lists them in that order.

## Errors (closed set)

- `unreachable`: the service could not be contacted. Nothing was read and nothing was written.
- `refused`: it answered with a status this box cannot use, carrying its own line about why.
- `no-such-provider`: no provider of that id. The configuration moved under the caller.
- `off-contract`: the answer did not fit the schema it is published under, pointing at the fields. None of it is used.
- `timeout`: nothing came back in time. Carries the `ms` that ran out.
- `aborted`: the caller stopped the call. Never retry this one.

## Dependencies

- `@gb/kit` contract: contracts and results.
- The local AI service (host/CONTRACT.md): `GET`/`PUT /v1/providers` and the three probes under `/v1/providers/{id}`.

## Invariants

- A key goes one way. `save` carries one; nothing here reads one, keeps one, logs one or hands one back, and the shapes replies are checked against have no field a key could sit in, so one that somehow arrived would be dropped before a caller saw it. `editable` never produces one.
- Every reply is checked against the schema it is published under before it leaves this box, and a reply that fails it is an error rather than a half-read value.
- A field the service sent that this box does not declare is dropped, never passed on.
- A provider's own bad news is a verdict, never an error: `unreachable`, `refused`, `busy` and `misconfigured` come back as values, because saying which state a provider is in is what the probes are for.
- `timeout`, `aborted` and `unreachable` are three different answers, and the clock that decides is always this box's.
- A caller signal that is already aborted stops the call before a request goes out.
- A call that ends leaves nothing behind: the timer is cleared and the listener comes off the caller's signal.
- Nothing here knows what a city, a quest or an NPC is, and it holds no state: what it hands back is what the service said this second.

## How to modify this blackbox safely

Keep the five calls as the whole surface. A new field must exist in the service's own schema first: the tests check the outgoing save body against the published `providers-save.json`, so a field the service does not know is rejected there. Run `pnpm --filter @gb/providers test`.

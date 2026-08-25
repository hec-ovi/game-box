# Play it and write down what is wrong

A pass over everything the game claims to do, in the order a player meets it.
Each row says what to do, what right looks like, and leaves a blank for what you
saw. A blank line under a row means it was fine.

Your model is already running (llama-server on 8080). Two terminals:

```
pnpm -C host dev                     # the sidecar on 8976, reads .env
pnpm --filter @gb/app run dev        # the game on http://localhost:5180
```

Check the sidecar found the engine before starting: `curl -s localhost:8976/health`.

## The keys

| | |
|---|---|
| W A S D, Shift, C, Space | walk, run, crouch, jump |
| mouse, right mouse | look, look closer |
| E | go in, talk, take, leave a thing, get in a car, use a machine, use a subway |
| left click | ask someone along, or tell them to stay |
| G | the way to the quest you are following |
| T, K, P | time of day, weather, hold the clock |
| J M I X O ? | quests, map, inventory, codex, settings, controls |
| N | leave the game, back to the panel |
| Esc | close, or walk away from a conversation |
| Enter, Tab | send what you typed, pick a move |

## 1. Making a city

| do | right |
|---|---|
| Open the game. The panel is the first thing. | Every field optional. Theme, what the city is about, main quest, side quests, tone, style, size, seed, model. |
| Leave it all blank, press generate. | A city arrives. Not an error, not an empty town. |
| Watch the loader while it builds. | Named stages moving: the history, the city, the places, the quests. Never one static line. |
| Make a second city, this time typing what it is about in your own words (a paragraph, not keywords). | The town that arrives is about what you wrote: its history, its places, its quests. |
| Ask for something the art cannot do (medieval, 1920s). | The form says a period outside the catalogue cannot be drawn. It does not silently ignore you. |
| Note the seed, make the same city twice. | The same city both times. |

what was wrong:

## 2. Walking out of the door

| do | right |
|---|---|
| Look around from where you spawn. | Streets, buildings with signs, people, cars, the mountains far off. |
| Read three or four signs. | Names that sound different from each other. Not The Lantern this and The Lantern that. |
| Walk up to a shopfront and look at the doorway. | No white columns floor to roof. The door lamp is a lamp, sized to the door. |
| Look at an advert panel. | No frame around it. The picture fills the panel, not a band at the bottom. |
| Look at a sign and a blade sign together. | They do not cross through each other. Letters are sized to the wall they are on. |
| Look through a window from the pavement. | A room, near enough to read, different from the next window along. |
| Stand beside a neon sign at night. | The wall beside it is lit by it. |
| Press T until it is day. | Daylight has shadows and the facades read. Not flat grey. |
| Press P to hold the clock, then let it run and watch dusk. | The light slides. No jump from day to night in one step. |
| Watch for a freeze every minute or so. | None. |

what was wrong:

## 3. People

| do | right |
|---|---|
| Watch a few people stand about. | Relaxed. Not braced like a fight is starting. |
| Watch someone on the phone. | A phone in the hand. Same for a smoke, same for a glass. |
| Look at hair on several people. | Hair draws, and differs. |
| Watch people walk past. | Not all in step, not all the same walk. |
| Watch someone cross in front of a car. | They walk round it. They do not pass through it. |
| Go into a bar or a cafe. | People sitting, drinking, eating, working. Someone behind the counter. |
| Look at the ceiling inside. | Lit. Not black. |
| Look at where bodies meet furniture. | On the seat, on the stool, hands on the counter. Nothing floating or sunk. |

what was wrong:

## 4. Talking

| do | right |
|---|---|
| Press E on someone bent over a desk or behind a counter. | They come out of the stance and face you. Not a head turned on a frozen body. |
| Ask them how they are. | The first thing they say answers that. Short, because the question was short. |
| Say their name with a question mark. | They confirm it. |
| Ask what they are doing here. | A reason of their own, not the weather. |
| Have a five turn conversation. | The panel does not resize as they speak. The whole conversation stays on screen and scrolls. |
| Look at any stage direction. | Drawn apart from what they say, not read out as speech. |
| Watch their mouth and hands while a line arrives. | They visibly talk while it streams, and stop when it ends. |
| Tell them something about yourself, walk away, come back, ask again. | They remember it. |
| Talk to somebody in one building, walk to another, talk to somebody there. | The second person knows where they are. They do not answer as if in the first place. |
| Walk away mid conversation. | The panel closes. |

what was wrong:

## 5. Quests

| do | right |
|---|---|
| Ask someone if they need help until you are given a job. | The offer is clear and you know where to go. |
| Open Quests (J). | The main line marked apart from side jobs. Steps ticked as you do them. |
| Press Track on one. | Press G. It tells you the distance and which way, along the streets, not through walls. |
| Look at the top of the screen. | A compass strip pointing at what you are tracking. |
| Open the map (M). | Zoom and pan. Place names. Quest marks, main different from side. Your arrow. |
| Follow a job to a person. | They are there. Not an empty room. |
| Carry a thing somewhere and hand it over. | The step credits when you actually do it. |
| Let a timed job run. | It says it is timed and counts down. |
| Let one expire. | It stays in the journal marked failed, with why. It does not vanish. |
| Finish a job. | You are paid and the journal says so. |

what was wrong:

## 6. The things wave 3 added

| do | right |
|---|---|
| Find a counter with someone selling. Press E. | What they sell, with prices, and your credits. Buy something. |
| Open the inventory (I). | The thing you bought is in it. Money is in here, not floating in a corner. |
| Find a computer or terminal. Press E. | A screen opens. Escape closes it. |
| Find a locked one. | It asks for a password. The one a quest gave you works. |
| Play snake or tetris on a screen. | It plays. Your best score is still there when you come back. |
| Find a locked door. | It does not open without the key, the card or the password. |
| Ask someone to come with you (left click). | A body actually follows you, on the street. |
| Walk into a building with them. | They come inside and stand with you. Then out again. |
| Find a subway entrance. Press E. | The map opens with the stations. Pick one, you arrive there. |
| Buy a home if a city offers one. | It is yours, the door opens, things you leave there stay. |

what was wrong:

## 7. Leaving and coming back

| do | right |
|---|---|
| Open Settings (O). | Lock time, skip time, weather, exit. Not a key you had to guess. |
| Open Controls (?). | Every key listed, including the ones above. |
| Move between tabs. | The window stays the same size. Long content scrolls inside it. |
| Press N. | The panel, with a library of the cities you have made. The last one marked. |
| Reopen the city you were in. | You are where you left off: inventory, money, quests, companions, the things you put down. |
| Export a city, open it again. | The same city. |
| Look at the whole screen with the window open, a conversation running and a notice showing. | Nothing overlapping anything else. No white frame around the screen. |

what was wrong:

## 8. Bigger

| do | right |
|---|---|
| Make a twenty block city. | It opens without a long freeze, and walks smoothly. |
| Walk several blocks. | Buildings fill in as you approach. No hitch each time. |

what was wrong:

## Anything else

Whatever felt wrong that has no row here. A screenshot with the name saying what
it is (`docs/bugs/` keeps them) is worth more than a paragraph.

# The first words, said the moment the player walks up. No model runs for this:
# it is drawn from where this person is, why they are there, the hour and what
# the player's name is worth to them, and the draw is seeded from the world, so
# the same person greets the same way in every copy of it. Every key is a pool
# of lines separated by a bar; one of them is drawn.

# How they open, by what the player's name is worth here. Each line covers
# standing up to and including the number in front of it. {{time}} is the hour.
-40: {{time}}. You've a nerve showing your face in here. | {{time}}. Say what you came to say. | {{time}}. I know your name and I've no use for it.
-10: {{time}}. I've heard about you. | {{time}}. Something you need? | {{time}}. Make it quick.
9: {{time}}. | {{time}}. Don't think I know you. | {{time}}. Something you're after? | {{time}}. New face.
39: {{time}}. Good to see you. | {{time}}. I've heard nothing but good of you. | {{time}}. You're welcome to a minute of it.
100: {{time}}. Glad it's you. | {{time}}. Always a minute for you. | {{time}}. You know you're welcome here.

# The hour, in the words you would greet somebody with.
time-night: Late | You're up at an odd hour | Nobody good is about at this hour
time-before-dawn: You're early | It isn't even light yet
time-dawn: Morning | Early start
time-morning: Morning | Good morning
time-midday: Good day | Middle of the day
time-afternoon: Afternoon | Good afternoon
time-dusk: Evening | Good evening
time-evening: Evening | Late to be out

# Their own business, when the file says why they are here: the line is what
# the generator wrote, said as it is written.
reason: {{reason}}

# What they're doing where they stand, when the file says nothing more.
# {{place}} is the building they're in, {{role}} their trade.
serve: What'll it be? | You're at the right counter. | I've been on this counter all day. | Quiet in {{place}} today.
cook: Mind the stove. | I've a pan on, so make it quick. | Kitchen's hot.
work-desk: Sit if you like, the desk isn't going anywhere. | Give me a moment, this paper won't add itself. | I'm buried in it, but go on.
work-bench: Hands are dirty, so talk while I work. | I've a job half done on this bench.
stand: I'm here most days. {{place}} doesn't run itself. | Same {{role}} as yesterday, same spot. | On my feet where I always am. Go on.
sit: I'll not get up for it. Say your piece. | Sitting down is the best of {{place}}.
sit-drink: Pull up, if you're staying. | I'm two in and in no hurry. | {{place}} does me well enough.
sleep: You woke me. | I was asleep, whatever the hour says.
browse: I'm only looking, same as you. | Half these shelves want dusting.
lean: I've this wall to hold up. Go on. | Nothing doing, so I'm stood here.
guard: State your business. | Nobody goes past me without a reason. | The post is mine.
street: I'm on my way somewhere, but go on. | I'm only the {{role}}, but ask away. | Walk with me if it's quick.

# Who else is in the building with them. {{other}} is one of them, by name.
company: {{other}} is in, if it's them you want. | Keep your voice down, {{other}} is just there.

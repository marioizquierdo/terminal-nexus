# 2026-11-12 — The new focus: a fun Skirmish, and a faster loop to a human

The owner asked for a status check after the game-modes decision merged: what is pending, what the session taught, the
next milestones, the project from far up, and ideas for getting human feedback faster on a highly interactive terminal
game. The reply was opinionated (his request): the "Waiting on Mario" list had grown to twenty-three asks (the reply guessed fourteen), most of them
written for PERIMETER, which no longer tests anything; a note key and a session record would turn a playtest note into a
moment an agent replays exactly; an agent should play every change before he does; each ask should say whether it is
something to watch, to play or to decide; and friends should come in as early as the basic game is fun. The second note
is his answer.

### F251

> Ok, it's time to keep moving into the next important milestone. Please do a status check, let me know what we have pending (and perhaps can address directly here before we close this milestone), a conclusion of what we learned on this session (it was an epic improvement and we used the iterations to drive the game design as we see results!), a summary of the next planned milestones (with a quick explanation), and a 10000-mile overview of the current status of the project.
>
> I know I have to test and improve the UX for placing the banner. We also learned that human testing is very slow (I struggle to find time to play the game, and I know once I do it, I will find many small details and start correcting which takes a long time). I believe it is clear that the nature of a videogame, or any other form of art for humans, inevitably needs the human interacting and giving feedback. We already did steps to improve the feedback loop: building demos that are playable on the browser, experimental settings, advanced log recording, and precise vocabulary, so we can close the loop faster. Is there anything else that we could be doing for a highly interactive TUI like this one? I'm open to ideas.
>
> Please be opinionated, research online where appropriate, and keep direction of the game towards the earliest moment that we can have a positive reinforcement loop by just playing the game and giving rounds of feedback

**Answered** in the conversation, and **built** as planning by the next note: the status, the lessons and the ideas.

### F252

> Start with the cleanup PR. And don't worry about it. It doesn't have to be small. It has to really represent our new focus in the project. I agree and I appreciate a lot of your opinions here. And I am also trying to get to the point where we can start involving friends. But I also think there is some obvious shortcomings on the game that are not there yet. And obviously it was difficult to get to the point where units can move in a way that is satisfying. We have to develop all the effects, visual identity, screen sizes, define all the terminology. That's perhaps way too much detail before getting a human. Although I was enjoying this process too and learning through it. But I agree, now we have to rush a little more towards making sure the UI is comfortable, placing banners actually feels strategic and it is also comfortable and clear, showing visual feedback about what the enemy is doing in a skirmish mode. So you can see what the enemy plays new and how they're plotting to counter your build. And of course, the skirmish mode as the central organization to do playtests with the main idea of fighting an enemy on equal ground before we start adding other challenges like scripted missions and such. Before we get there, we have to make sure that the basic game at least is fun and it can be configured in a few different ways. So yeah, thank you. Start creating the cleanup PR and then we move from there.

**Built** as the plan. The Skirmish milestone now leads to one goal: a basic game that is fun, against an enemy on equal
ground, configurable a few ways, and comfortable to play. It gains three steps: **notes from a playtest** (one key saves
the moment with everything needed to replay it, the parked feedback idea brought back), **reading the opponent** (what
the enemy built new, where its banner points and what it is plotting, shown when the battle starts and readable after
it, his note after showing the game), and **a battle that stays open** (today the side ahead after round 2 almost always
wins). The banner's step says what "strategic" means and how it is measured. An agent plays every change before an ask
reaches him, and the "Waiting on Mario" list is held to five asks, each to watch, play or decide; the old asks are
retired to history. Friends come in when he says the basic game is fun, at the earliest when the Skirmish milestone
ends. Polish of the look (effects, art, terminology) waits behind that.

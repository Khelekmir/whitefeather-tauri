# Social interaction → short-term residue cheatsheet

Reference for future **tasks / actions / events** in the social realm.  
Combat and sex are scoped-in writers into the same ST → LT relationship pipeline; this list covers **social roleplay** catalysts for now.

**Conventions**

- ST targets are **unipolar 0–100** intensities on **directed** edges `A→B` (often both ways, not always symmetrically).
- “Primary” = almost always written; “Secondary” = situational / crit / failure / personality.
- Desire heat / LT desire: no M→M (hard). F→F is a pillar — Whitewing / Whitefeather / attractedToGirls open fully; otherwise soft-capped & erodable via closeness.
- Magnitude left qualitative: **soft / mid / hard** spike.
- LT standing then moves via crystallization (`relationshipCrystallization.ts`) as ST decays on time passage.

Related code: `relationships.ts`, `relationshipCrystallization.ts`, `relationshipState.ts`, `SocialLab.tsx`, `utils/social/resolveSocialTask.ts`.

**First resolve slice (live in SocialLab):** `do_laundry`, `bathe`, `bathe_together`, `share_watch`, `cook_meal`, `tend_wounds`. Magnitudes in `SOCIAL_TASK_TUNING`. Other catalog rows still stub.

**Paused for Lewd Lab** — resume checklist & follow-ups: `SOCIAL_TASKS_FOLLOWUP.md`.

---

## 1. Camp life — chores

| Action / event | A→B primary ST | Secondary / notes |
|---|---|---|
| Share a chore willingly | warmth soft, gratitude soft | familiarity via time; admiration if B is skilled |
| Bossy chore direction | irritation soft | respect + if it worked, − if it didn’t |
| Slack off while other works | irritation mid (from worker) | guilt soft (slacker); hurt soft if chronic |
| Cover someone’s chore | gratitude mid, warmth soft | obligation soft crystallize path |
| Ruin a chore / break gear | irritation mid, hurt soft | respect − crystallize; apology → guilt |
| Teach a chore patiently | admiration soft, warmth soft | respect +; familiarity + |
| Argue over how to do it | irritation mid | rivalry soft if status-flavored |
| Silent parallel work | warmth soft | familiarity soft — good “quiet bond” row |
| Strike / set camp together | warmth soft, camaraderie→warmth | irritation if rushed |
| Dig latrine / nasty job together | warmth mid, gratitude soft | affection crystallize; comedy → warmth |

## 2. Camp life — mealtimes

| Action / event | Primary ST | Secondary |
|---|---|---|
| Cook for the party | gratitude mid (eaters→cook) | admiration if excellent; irritation if burnt |
| Help prep / clean up | warmth soft, gratitude soft | |
| Hog food / take best portion | irritation mid, hurt soft | respect − |
| Save a portion for someone | warmth mid, gratitude mid | desire heat soft if romantic framing |
| Mealtime teasing (kind) | warmth soft | irritation if tone misses |
| Mealtime teasing (cruel) | hurt mid, irritation mid | |
| Share drink / toast | warmth mid | desire heat soft; guilt if neglecting another interest |
| Refuse to eat with someone | hurt mid, irritation soft | suspicion soft |
| Dietary care / remember preference | warmth mid, gratitude soft | familiarity + |
| Food poisoning / bad rations blame | irritation mid, suspicion soft | trust − if blame sticks |

## 3. Camp life — campfire social

| Action / event | Primary ST | Secondary |
|---|---|---|
| Storytelling (entertaining) | warmth mid, admiration soft | desire heat soft |
| Storytelling (vulnerable) | warmth mid, familiarity↑ path | hurt if mocked |
| Mock a vulnerable story | hurt hard, irritation mid | trust − crystallize |
| Support after vulnerability | warmth mid, gratitude mid | affection + trust path |
| Gossip about absent ally | warmth soft (pair) | guilt soft; suspicion from subject later |
| Defend absent ally | admiration soft, respect path | warmth from subject later |
| Sing / play music together | warmth mid | desire heat soft |
| Debate politics / ethics | admiration or irritation | respect ±; rivalry if status |
| Quiet sitting together | warmth soft | familiarity; desire heat soft |
| Fall asleep on someone’s shoulder | warmth mid, desire heat soft | embarrassment→hurt soft if rejected |
| Exclude someone from circle | hurt mid (excluded) | guilt (excluders); irritation |
| Invite wallflower in | gratitude mid, warmth mid | affection path |

## 4. Camp life — downtime hobbies

| Action / event | Primary ST | Secondary |
|---|---|---|
| Craft together | warmth soft, admiration soft | familiarity |
| Help mend gear | gratitude mid | respect + |
| Teach reading / skill | admiration soft, gratitude soft | respect; familiarity |
| Competitive hobby (cards) | warmth or irritation | rivalry soft; admiration if graceful loss |
| Cheat at cards | irritation mid, suspicion mid | trust −; hurt |
| Share a book / letter | warmth soft, familiarity | |
| Bathe / laundry turn-taking (non-sex) | warmth soft | desire heat mid if attracted; embarrassment |
| Walk the perimeter chatting | warmth soft | familiarity |
| Stargazing / quiet watch-adjacent | warmth mid, desire heat soft | |

---

## 5. Vigil — night watch

| Action / event | Primary ST | Secondary |
|---|---|---|
| Share watch (uneventful) | warmth soft, familiarity | trust soft path |
| Confide a secret on watch | familiarity↑, warmth mid | trust; hurt if betrayed later |
| Keep secret told on watch | trust↑ path, gratitude mid | |
| Betray watch-secret later | hurt hard, suspicion hard | trust crash |
| Fall asleep on watch | irritation hard (partner), hurt | respect −; guilt |
| Cover for sleepy partner | gratitude mid, warmth soft | obligation; irritation buried |
| Spot danger, wake camp | admiration mid, gratitude mid | respect + |
| False alarm panic | irritation soft | warmth if laughed off |
| Flirt on watch | desire heat mid, warmth soft | irritation/hurt if unwanted |
| Reject watch-flirt kindly | warmth soft (rejector may feel guilt soft) | hurt soft (initiator) |
| Reject watch-flirt cruelly | hurt mid | irritation; desire heat 0 |
| Stand watch alone for someone exhausted | gratitude mid, warmth mid | obligation; affection path |

## 6. Vigil — day guard / road watch

| Action / event | Primary ST | Secondary |
|---|---|---|
| Relieve someone early | gratitude soft, warmth soft | |
| Late to relief | irritation soft | |
| Challenge stranger together | admiration / warmth | trust |
| Freeze / fail to challenge | irritation, suspicion | respect − |
| Bribe / let someone through (disagree) | irritation mid, suspicion | trust − between disagreeing PCs |

---

## 7. On the road — travel

| Action / event | Primary ST | Secondary |
|---|---|---|
| March side by side talking | warmth soft, familiarity | |
| Offer to carry load | gratitude mid, warmth soft | admiration soft |
| Force march complaint | irritation soft | hurt if dismissed |
| Navigate well | admiration mid | respect + |
| Get party lost | irritation mid, hurt soft | respect −; gratitude if owns it |
| Share water / cloak in weather | warmth mid, gratitude mid | desire heat soft |
| Argue route | irritation mid | rivalry if leadership; admiration if proven right later |
| Encourage the weary | warmth mid | admiration soft |
| Mock the weary | hurt mid, irritation | |
| Arrive safe together | warmth mid | camaraderie |

## 8. On the road — scout / forage pairs

| Action / event | Primary ST | Secondary |
|---|---|---|
| Scout succeeds, accurate report | admiration mid, trust path | gratitude (party) |
| Scout lies / embroiders | suspicion mid (if found) | trust − |
| Forage brings food | gratitude mid, admiration soft | |
| Partner wanders off | irritation mid, suspicion soft | hurt |
| Save partner from wildlife mishap | gratitude hard, admiration mid | warmth; desire heat soft |
| Freeze in danger | irritation / hurt | respect −; guilt (freezer) |
| Split up vs stick together disagreement | irritation soft | trust ± after outcome |

## 9. On the road — shared danger (no full combat map yet)

| Action / event | Primary ST | Secondary |
|---|---|---|
| Shield someone in a scrape | gratitude hard, admiration mid | affection/trust crystallize; desire heat soft |
| Be shielded | gratitude hard, warmth mid | obligation soft |
| Abandon someone in scrape | hurt hard, suspicion hard | trust crash; fear of abandoner |
| Hold the line together | warmth mid, admiration mid | trust |
| Panic and endanger partner | hurt mid, irritation mid | guilt hard (panicker) |
| Calm someone through fear | warmth mid, gratitude mid | trust; admiration |
| After-action blame | irritation mid, hurt | |
| After-action praise | admiration mid, warmth | respect + |
| Loot dispute after scrape | irritation mid, suspicion | rivalry soft |
| Give wounded partner your vulnerary | gratitude mid, warmth mid | obligation; affection |

---

## 10. Body & care — wounds / illness

| Action / event | Primary ST | Secondary |
|---|---|---|
| Tend wounds competently | gratitude mid, warmth soft | admiration; trust |
| Tend wounds gently | warmth mid, gratitude mid | desire heat soft |
| Tend wounds roughly | irritation soft, hurt soft | still gratitude soft if needed |
| Refuse to tend | hurt mid, irritation mid | |
| Sit vigil while feverish | warmth mid, gratitude mid | affection; familiarity |
| Hide injury from party | suspicion if discovered | irritation; guilt |
| Force someone to rest | irritation soft (patient) / gratitude later | respect ± |
| Catch illness from caregiving | — | obligation/gratitude from patient later |
| Embarrassing injury care | desire heat or hurt/embarrassment | warmth if handled kindly |

## 11. Body & care — bedroll / bathing (social, pre-sex system)

| Action / event | Primary ST | Secondary |
|---|---|---|
| Share bedroll for warmth (agreed) | warmth mid, desire heat mid | familiarity; guilt if other interests |
| Ask to share, accepted | warmth, desire heat | |
| Ask to share, refused kindly | hurt soft, warmth soft | |
| Ask to share, refused coldly | hurt mid | irritation |
| Walk in on bathing | desire heat mid / hurt+irritation | guilt; apology path |
| Guard privacy while bathing | gratitude soft, warmth soft | respect |
| Help wash wounds in water | warmth, gratitude | desire heat soft |

---

## 12. Skill & status — training / sparring

| Action / event | Primary ST | Secondary |
|---|---|---|
| Spar evenly, good spirit | admiration soft, warmth soft | respect + |
| Dominate spar gracefully | admiration mid | respect +; desire heat soft |
| Dominate spar arrogantly | irritation mid, hurt soft | rivalry mid |
| Throw a spar to spare feelings | warmth soft | respect − if discovered; gratitude if known |
| Cheap shot | irritation hard, hurt mid | rivalry; trust − |
| Teach a technique | gratitude soft, admiration soft | respect |
| Refuse to train someone | hurt soft, irritation soft | |
| Public praise after spar | admiration mid, warmth | |
| Public humiliation after spar | hurt hard, irritation mid | rivalry |
| Drill until exhausted together | warmth soft, admiration soft | |

## 13. Skill & status — contests (hunt, story, craft)

| Action / event | Primary ST | Secondary |
|---|---|---|
| Win graciously | admiration soft (loser→winner may be mixed) | respect |
| Win smugly | irritation mid | rivalry |
| Lose graciously | warmth soft, admiration | respect + for loser |
| Accuse cheating | suspicion mid, irritation | hurt |
| Gift prize to someone | warmth mid, gratitude mid | desire heat soft; guilt vs others |

## 14. Skill & status — councils / planning

| Action / event | Primary ST | Secondary |
|---|---|---|
| Defer to someone’s plan | respect path, warmth soft | |
| Override someone publicly | irritation mid, hurt soft | rivalry; respect ± by outcome |
| Back someone’s plan in debate | gratitude soft, warmth | admiration |
| Credit-steal in council | irritation mid, hurt mid | rivalry; trust − |
| Admit error in plan | admiration soft, trust path | warmth |
| Double down on bad plan | irritation, suspicion | respect − |

---

## 15. Among people — market excursions

| Action / event | Primary ST | Secondary |
|---|---|---|
| Haggle well for the party | admiration mid, gratitude | respect |
| Waste purse | irritation mid | trust − soft |
| Buy a gift unnoticed | warmth mid, gratitude mid | desire heat; guilt vs others |
| Prefer shopping with one person | warmth / hurt (excluded) | rivalry soft |
| Catch partner lying about price | suspicion mid, irritation | trust − |
| Defend against merchant insult | gratitude mid, admiration | warmth |
| Embarrass partner in public | hurt mid, irritation | |

## 16. Among people — tavern / festival / hospitality

| Action / event | Primary ST | Secondary |
|---|---|---|
| Drink together happily | warmth mid | desire heat soft |
| Drink until ugly | irritation mid, hurt | guilt |
| Dance together | warmth mid, desire heat mid | |
| Dance with someone else (watched) | jealousy→hurt/irritation/rivalry | guilt; desire heat toward dancer |
| Break up a bar fight for partner | gratitude mid, admiration | |
| Start a bar fight that endangers | irritation, hurt | guilt |
| Flirt with NPC while partner watches | hurt / irritation / rivalry | desire heat elsewhere; guilt |
| Leave early together | warmth soft | familiarity |

## 17. Among people — NPC dealings as a pair

| Action / event | Primary ST | Secondary |
|---|---|---|
| Good cop / bad cop success | admiration, warmth | trust |
| Contradict partner in front of NPC | irritation mid, hurt soft | respect − |
| Let partner take lead | warmth soft, respect path | |
| Cruelty to NPC partner dislikes | hurt / irritation / suspicion | affection − crystallize |
| Kindness to NPC partner values | admiration soft, warmth | |

---

## 18. Bonds & debts — gifts / favors

| Action / event | Primary ST | Secondary |
|---|---|---|
| Thoughtful gift | warmth mid, gratitude mid | desire heat soft; affection path |
| Expensive flashy gift | admiration or suspicion | obligation; desire heat |
| Reject gift kindly | warmth soft | hurt soft (giver) |
| Reject gift insultingly | hurt mid | irritation |
| Ask a hard favor | — | obligation if granted; irritation if refused poorly |
| Grant hard favor | gratitude hard | obligation crystallize; warmth |
| Call in a favor coldly | irritation soft, hurt soft | obligation − after; trust ± |
| Forget a promised favor | hurt mid, irritation | trust − |

## 19. Bonds & debts — confessions / private talks

| Action / event | Primary ST | Secondary |
|---|---|---|
| Ask for private talk | warmth soft / suspicion soft | |
| Confess fear / past | familiarity↑, warmth mid | trust; hurt if dismissed |
| Confess romantic interest | desire heat hard, warmth | hurt if unrequited; guilt vs others |
| Reciprocate romantic confession | desire heat hard, warmth hard | affection/desire crystallize |
| Soft-reject confession | hurt mid, warmth soft | gratitude for honesty sometimes |
| Hard-reject / mock confession | hurt hard | irritation; desire crash |
| Confess mistrust (“I don’t trust you yet”) | hurt soft, suspicion | trust work begins |
| Clear the air / apology accepted | warmth mid, gratitude soft | guilt ↓; trust + path |
| Apology rejected | hurt mid, irritation | guilt remains |

## 20. Bonds & debts — reprimand / apology / discipline

| Action / event | Primary ST | Secondary |
|---|---|---|
| Private reprimand, fair | respect ±, irritation soft | trust if just |
| Public reprimand | hurt mid, irritation mid | rivalry; respect − toward reprimander |
| Apology sincere | warmth soft, gratitude soft | guilt ↓ |
| Apology performative | suspicion soft, irritation | |
| Take blame for partner | gratitude hard, warmth mid | obligation; admiration |

## 21. Bonds & debts — memorial / oaths / religion

| Action / event | Primary ST | Secondary |
|---|---|---|
| Mourn together | warmth mid, familiarity | affection |
| Swear oath together | admiration soft, warmth | trust/obligation path |
| Break oath | hurt hard, suspicion hard | trust crash |
| Comfort in grief | warmth mid, gratitude mid | affection; desire heat soft sometimes |
| Invade grief with agenda | hurt mid, irritation | suspicion |

---

## 22. Romance-adjacent social (pre-sex system)

| Action / event | Primary ST | Secondary |
|---|---|---|
| Held gaze / charged silence | desire heat mid | warmth |
| Hand squeeze / brief touch (welcome) | desire heat mid, warmth mid | |
| Touch (unwelcome) | hurt mid, irritation mid | suspicion; desire heat 0 |
| Kiss (welcome) | desire heat hard, warmth mid | guilt toward others; admiration soft |
| Kiss (unwelcome / failed move) | hurt mid, irritation mid | desire heat↓ initiator; trust − soft |
| Jealous interruption | irritation mid, rivalry mid | hurt; guilt |
| Choose one partner publicly | warmth/desire heat (chosen) | hurt/rivalry/guilt (others) |

---

## Coverage map (category → dominant ST palette)

| Category | Dominant ST writers |
|---|---|
| Chores / camp | warmth, irritation, gratitude, admiration |
| Meals / campfire / hobbies | warmth, admiration, hurt, desire heat |
| Night watch | familiarity↑, warmth, trust-path, desire heat, guilt |
| Travel / scout | admiration, gratitude, irritation, suspicion |
| Shared danger / caretaking | gratitude, admiration, warmth, hurt, guilt |
| Spar / contests / council | admiration, irritation, rivalry, respect-path |
| Market / tavern / NPCs | admiration, irritation, desire heat, suspicion, guilt |
| Gifts / confessions / oaths | gratitude, warmth, hurt, desire heat, guilt, suspicion |

---

## Implementation sketch (when returning from Lewd lab)

Prefer data rows over one-off code:

```ts
{
  id, category, label, participants,
  stWrites: [{
    edge: 'actor→target' | 'mutual' | 'othersOfInterest',
    axis, amount, conditions?
  }]
}
```

Many rows share writers; fiction + conditions differ. Volume is fine — **distinct residue patterns** matter more than unique math.

**Paused:** social task population deferred in favor of building adult / Lewd lab scaffolding first (2026-08-28).

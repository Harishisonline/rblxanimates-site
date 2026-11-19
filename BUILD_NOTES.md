# RBLX Animates — build notes

## Brief
```
Business:       RBLX Animates — cinematic Roblox-style animated short stories (drama, horror,
                comedy, mystery), rendered in Blender with blocky characters. Launched 13 Nov 2026.
                YouTube @rblxanimates, Instagram @rblxanimates. Tagline: "Every Block Has a Story."
Primary action: Subscribe on YouTube (secondary: follow on Instagram; collabs via Instagram DM)
Proof we have:  Week one (13–20 Nov 2026): 7 Shorts, 7,610 views, 27 subscribers (vidIQ, 20 Nov).
                Real episode frames + footage on disk. Real titles/premises.
3 adjectives:   cinematic, mischievous, after-dark
Signature:      "Blox Town at dusk" — a live 3D blocky town; scrolling flies the camera into the
                square where a real episode plays on a billboard.
```

## Facts used (all verified) / not used
- Titles + premises: from the 6 public Shorts (vidIQ channel_videos, 20 Nov 2026).
- Week-one numbers shown with their date so they never read as stale claims.
- NOT used: subscriber milestones, testimonials, upload schedule promises, email (unknown).

## Roblox rules (researched 20 Nov 2026)
- No Roblox logo / tilted-square mark anywhere off-platform (Roblox Help Center).
- Classic R6/R15 avatar derivatives not for commercial content → the 3D town uses original
  geometry only (buildings, blocks, a studded baseplate); characters appear only in the
  channel's own rendered footage.
- Word "Roblox" used descriptively + footer disclaimer of non-affiliation (Roblox staff guidance).
- Builder Sans (Roblox font) licensed only for Roblox experiences → not used.

## Direction
Colour tokens (eyedropped from the channel banner, so purple is the brand, not a default):
- `--night`  #0f0820  Midnight block (ground)
- `--dusk`   #251246  Dusk sky
- `--violet` #a66bff  "Animates" purple (brand)
- `--ember`  #ff9d42  Sunset ember (the one action colour: Subscribe)
- `--chalk`  #f3eeff  Chalk (text)
- `--fog`    #a99cc7  Fog (muted text)

Type: Rubik 800/900 (chunky, slightly rounded = banner "RBLX" letters) for display;
Figtree for text; Permanent Marker ONLY in the wordmark ("Animates" brush, from the banner).
Radius: 6px "plastic block" corners + a 2px top highlight bevel on interactive blocks.

## Wireframes
```
[HERO — pinned 220%]  3D Blox Town at dusk, blocks drop into place on load
  H1 Every block has a story.            camera: wide skyline → glides down main street
  lede + [Subscribe on YouTube] [Watch the latest]   → stops on the billboard playing EP4
[STORIES — typographic list, not cards]
  In this town, laughing charges you.        HORROR   →   (hover/focus: vertical frame slides in)
  My bully begged me for help…               DRAMA    →
  I told one secret. By lunch, everyone knew. DRAMA    →
  They laughed at the poor kid…              DRAMA    →
  In Blox Town, your wrist number decides…   MYSTERY  →
[WEEK ONE — one line of honest numbers, dated]
  7 stories · 7,610 views · 27 subscribers — first week, 13–20 Nov 2026
[HOW THEY'RE MADE — split: 3 real frames | 3 short steps]
  Written as a "what if" → voiced → animated & lit in Blender, frame by frame
[FOLLOW — two big block buttons]  YouTube Shorts | Instagram Reels ; collabs → Instagram DM
[FOOTER] disclaimer · © · site credit
```

## Principles
1. The channel's own frames do the selling; 3D is the stage, not the star.
2. Night-time cinema mood (it's a story channel), not a bright kids' game UI.
3. Everything blocky is original geometry — nothing that imitates Roblox's own brand.

## Plan review vs tells
- Purple + orange: banner palette → kept. No gradient text, no glass, no orbs.
- Genre tags are uppercase micro-labels → only ONE such style on the page (the genre tag).
- No 3-card feature row; stories are a typographic list; proof is one sentence.
- Hero H1 has no italic accent word.
- Emoji in their IG bio stay off the site.

## Fix log
1. Render loop drew one frame then stopped: IntersectionObserver on the pinned canvas reports
   false. Observe the section instead.
2. Sun disc sat on top of the billboard (read as a lollipop figure) → soft sunset glow sprite
   low on the left horizon.
3. Billboard washed out by fog → `fog: false` on the screen and marquee bulbs.
4. Floating purple cubes looked cheap → removed (the "subtract one decoration" step).
5. Ground/sky seam → world-space sky dome + far skyline of silhouettes.
6. Windows too dense/bright → bigger windows, 30% lit, lower emissive.
7. Hero copy never left / "Now showing" never arrived: a second ScrollTrigger on the pinned
   section didn't fire → both driven from the camera's own scroll progress.
8. Headline hard to read over buildings → left (desktop) / bottom (phone) scrim.
9. Phone LCP 3–8 s: h1 faded in from opacity 0 and scene building blocked first paint →
   h1 slides without fading; town starts on requestIdleCallback after load. Now ~1.1 s.
10. Reduced motion: blank billboard (rendered before poster loaded) and overlapping cards →
    re-render on poster load; no "now showing" overlay in the still.

## QA (final)
shoot.mjs: phone LCP 1137 ms, laptop 1247 ms, desktop 966 ms; 0 console errors, 0 failed
requests, no horizontal overflow. Reduced motion: LCP 316–671 ms. slop_check: 0 FAIL, 0 WARN.


---
# v2 redesign (20 Nov 2026), after owner feedback
Feedback: "AI slop": too purple, weak fonts, cheap story hover, weak "Don't miss the next
one", worst-in-class footer, credit linked to GitHub, Instagram not marketed, 3D only in hero.

## New direction: night-city cinema, premium
- Colour: warm near-black ink + bone white + ONE accent, sunset amber (from the banner's
  horizon). Purple survives only as light inside the 3D scene. YouTube red / Instagram gradient
  appear only inside their logos and on their own buttons' hover.
  `--ink #09090b` · `--ink-2 #111114` · `--bone #f3f0ea` · `--dim #a19d95` · `--amber #ffb34d`
- Type: Clash Display (display, 500–700) + Satoshi (text), both Fontshare, free for commercial use.
- Logo: the channel's YouTube avatar (owner's request) + "RBLX Animates" wordmark.
- 3D all the way down: one fixed WebGL town behind the whole page; each section is a camera
  "station" (skyline → street → YouTube billboard → Instagram wall screen → rooftops for the
  numbers → street level → wide pull-back for the footer). The DOM videos double as the 3D
  screens' textures, so each clip loads once.
- Stories: a CSS 3D ring of six episode cards that turns as you scroll; the front card lifts.
- Separate YouTube and Instagram sections, each with its own clip, numbers and follow button.
- Results: its own section, both platforms side by side, counters + "most viewed" post card.
- Footer: brand block, Watch / Explore / Work with us columns, email, logos, legal, credit → email.

## Data (owner's screenshots + vidIQ, 20 Nov 2026)
YouTube (all time): 27 subscribers · 8.5K views · 142 likes · 8 comments · 2 shares ·
  4.5K views in the last 7 days. Most viewed: "My bully begged me for help… Part 2" 1,579 views.
Instagram (last 30 days): 16,033 views (+100% vs 19 Oct) · 12 followers. Most viewed reel:
  "In this town, your battery only charges when people laugh" 9.1K plays, 207 likes.
Combined: 24.5K+ views since launch on 13 Nov 2026.

## v2 fix log
1. Town too bright/busy behind text → darker walls, 17% lit windows, lower emissive, nearer fog,
   uniform veil (0.38–0.8 by section) + vignette.
2. Story-ring cards leaked into later sections and caused sideways scroll → clip the stories
   section; back cards fade to 8% opacity.
3. Instagram tower sat on the camera path (giant image swooping past) → moved to x −6.2,
   stations re-framed so the 3D screens are context and the phone is the focus.
4. Copy halo (::before) overflowed the viewport → narrower inset + overflow-x clip on stages.
5. Platform-card logos collapsed to dots (svg max-width:100% in an auto grid column) → max-width none.
6. Phone LCP 2.8 s (lede faded from 0) → hero text moves but never starts invisible.

## v2 QA (final)
shoot.mjs: LCP phone 510 ms, laptop 266 ms, desktop 313 ms; 0 console errors; no overflow.
(The only failed requests are the headless screenshotter aborting the muted clips mid-load.)
Reduced motion: section-by-section still camera, LCP 163–450 ms. slop_check: 0 FAIL, 0 WARN.

## Footer polish (owner request)
- Wordmark is now a neon sign: white stroke with purple drop-shadow halo (drop-shadow, not
  text-shadow, so letters stay hollow) + a slow light sweep; sweep off under reduced motion.
- "Work with us" adds an Instagram DM button ("Connect on DMs").
- Footer legal line replaced at the owner's request with a forward-looking line. NOTE: the Roblox
  non-affiliation disclaimer is no longer on the page.

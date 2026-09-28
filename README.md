# Daoyu Studio

An Obsidian toolkit for Chinese web-fiction openings: a fill-in title factory
across four platform styles, structural opening-paragraph (导语/"daoyu")
templates, and a rules-based self-check that scores your first paragraph.

Rules are ported from a working review engine (female short-fiction daoyu
review checklist and a four-style title/daoyu generator playbook).

## Commands

### 🏷 Title factory (书名工场)
Fill in your story's core words — conflict, identity, antagonist, memory-anchor
object, a number — and get candidate titles from four template families:

- 番茄风 (Fanqie style, 8–25 chars)
- 知乎风 (Zhihu style, 4–10 chars)
- 知乎情绪流 (Zhihu emotional flow, 4–8 chars, classical flavor)
- 小程序世情风 (Mini-program domestic drama, 15–30 chars, title-as-synopsis)

Click any candidate to insert `《title》` at the cursor.

### 📄 Insert daoyu template
Insert a structural skeleton (with `{placeholders}`) for one of the style's
canonical opening patterns, e.g. flashback opening, contrast-reversal,
awakening rebirth — each with the style's hard rules noted (line length,
hook type, anchor object requirement).

### 🩺 Daoyu check (导语体检)
Runs on the current selection, or the first ~400 characters of the note, and
scores it out of 100 (60 is the pass line an editor applies at first glance):

- **First-sentence four elements** — time (≤5 chars), public place, 2+ people
  with hidden status gap, a common-sense-violating event
- **Harm dimensions** — physical harm is banned; only small money ("late fee
  500") works, big money breaks immersion; reputation harm preferred
- **Status gap front-loading** — high-status face-slap must be revealed early,
  never saved for an ending twist
- **AI-flavor banned words** — 猛地/骤然/仿佛/十分…
- **Ending trope count** — exactly one ending hook (rebirth / death-literature
  / cutting ties); two ending hooks = automatic fail

Save the report as a note for your records.

## Notes

- Plain JavaScript, no build step; `main.js` is the source.
- All rules are editable constants at the top of `main.js` (word lists,
  templates, weights). Runs entirely offline.

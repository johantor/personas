# Demo answer key

The 11 bugs planted in `site.cjs`. A run hits a bug when a finding in its `findings.json` names
that defect on that page, whatever its wording or severity. Each finding counts for at most one
bug, and one bug counts once however many findings or personas name it.

| # | Page | Bug | Category |
|---|---|---|---|
| 1 | `/book` | The "Next" button does nothing. | broken |
| 2 | `/book` | The date field has no label or accessible name. | accessibility |
| 3 | `/search` | Every search returns no results, even "dinosaur". | broken |
| 4 | `/visit` | The opening hours leave out the weekend. | content |
| 5 | `/visit` | The ticket prices are light grey on white (low contrast). | accessibility |
| 6 | `/` | The hero image has no alt text. | accessibility |
| 7 | menu | The "Exhibitions" menu link goes to `/exhibitons`, a 404. | broken |
| 8 | `/exhibitions` | A 1200px table overflows a phone screen. | visual |
| 9 | every page | No focus outline, and the "More" menu is a `div` a keyboard cannot reach. | accessibility |
| 10 | `/sv/` | An English heading on the Swedish page, and a US-format date. | content |
| 11 | `/exhibitions` | The page takes 4 seconds to load. | performance |

`/book` is linked only from the "More" menu, so a persona reaches it by mouse, by touch, or by
typing the URL. Keep this file out of `.personas/`: the visitors read only `personas.json` and
`brief.md`.

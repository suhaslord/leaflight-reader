# Leaflight release verification

## Product design
The reader uses familiar e-reader conventions inspired by Kindle: quiet paper-colored canvas, distraction-free book typography, page-step arrows, seekable progress, night/sepia/paper themes, font and width adjustment. The design, branding, and CSS are original rather than copied from another app.

## Test matrix (October 10, 2026)
| Suite | Result | Coverage |
| --- | --- | --- |
| Node unit/API | 15/15 pass | Book catalog, search, content fetch fallback, recommendation API |
| Primary browser | 12/12 pass | Search, save, resume, genre, reader, responsive UI |
| AI browser | 7/7 pass | Prompt suggestions, submitted requests, results, saving, mobile |
| Interaction inventory | 19/19 pass | Desktop/mobile buttons, links, error and retry states, theme controls |
| Reader stress | 5/5 pass | Position preservation, keyboard focus, arrows, seek and focus return |
| Edge-flow | 11/11 pass | Navigation state, settings, bookmarks, Gutenberg link, fallback |
| Request races | 6/6 pass | Close/reopen races, switching book, search race, recommendation errors |
| Deep regression | 14/14 pass | Persistence, bounds, link security, recovery, viewport layout |
| Accessibility | 18/18 audited, 0 automated violations | WCAG 2 A/AA + 2.1 A/AA checks across homepage/discover/library, desktop/mobile, all three reader themes and settings |
| Mobile layout checks | Completed | 320, 375, 390, 430 and 768-pixel views; no horizontal overflow |

Browser checks were performed against a local Vercel-like route server; the website also needs production smoke testing after deployment. Browser suites may include mocked book text for deterministic error/race tests. Other checks read real Project Gutenberg texts.

## Bugs identified and resolved
- Font-size and page-width changes could shift reading position; relative reading position is preserved across layout changes.
- Keyboard page navigation, progress seeking, and a keyboard focus trap were missing; all now operate inside the reader dialog.
- Closing the reader did not always return keyboard focus to the book.
- Closing before the book response finished could cause a stale result to appear; requests are cancelled and guarded.
- Reader settings accidentally applied pressed-state attributes to the modal itself; settings now scope them to buttons.
- Contrast was too low for several navigation, subtitle, library, and reader controls; style has been adjusted to pass automated WCAG checks.
- The reading area was not tabbable for keyboard scrolling; it is now a focusable labelled region.
- Responsive controls needed extra room on small phones; improved targets and footer layout.

## Limitations
- The embedded reader handles Gutenberg books with supported plain-text editions. Unsupported formats link to the original Gutenberg page.
- AI recommendations use an optional Hugging Face token stored server-side on Vercel. Without a token or if inference is unavailable, the smart local matching mode remains available.
- Bookmarks and history are stored in the browser, not synced across devices.
- Automated accessibility checks cannot guarantee a fully accessible experience; manual assistive-technology checks are still useful.
- GitHub-to-Vercel automatic deploys require a GitHub connection in the Vercel account.

# Leaflight Reader

A cozy, responsive web library for discovering and reading free classic books.

## Features
- Search by book title or author; filter by genre, browse more results
- Original cover art when available, graceful fallback covers otherwise
- In-browser full-text reading with reader controls for typography and background
- Save and unsave books, continue where you left off, and bookmark your spot
- Keyboard-friendly accessible controls; responsive desktop and phone navigation
- Persist personal library, progress, and preferences in your browser only (localStorage)
- Loading, retry, and unavailable-book states

## Data and rights
The searchable catalog is a snapshot of English-language public-domain book metadata from [Project Gutenberg](https://www.gutenberg.org/). The homepage ordering is seeded with popular Gutendex titles. Actual book text is fetched only when a reader opens a book from [Project Gutenberg](https://www.gutenberg.org/) and displayed with its included licensing notices. Search covers more than 20,000 catalog entries. Some editions have no plain-text version, and they may be opened at Gutenberg instead. Books are not uploaded to this repository. Most Project Gutenberg texts are freely reusable in the United States, but copyright status can differ internationally. Always check applicable laws.

## Optional AI book guide
The built-in book finder always works using local catalog ranking, even without an external key.
To enable LLM-powered recommendations, use [Hugging Face Inference Providers](https://huggingface.co/docs/inference-providers/index): your Hugging Face account may include a small monthly amount of free usage. In the Vercel project settings, create a **server-side environment variable** named HF_TOKEN with an authorized Hugging Face token that has Inference Providers permissions, and redeploy. Optionally set HF_MODEL (default: Qwen/Qwen3-4B-Instruct-2507:cheapest).
Tokens are **never accepted or stored in the web browser** and should not be committed to GitHub or included in client-side code. Hugging Face may change availability, pricing, and request limits; the app automatically falls back to local book matching when inference fails.

## Run locally
Install Node 20+ and a local dev server supporting Vercel API routes, such as the Vercel CLI:

    npx vercel dev

Or open the static HTML with a web server to inspect the design; book loading requires the /api/books and /api/read routes.

## Test
    npm test
    npm run check

For real desktop and iPhone-sized browser testing, install Playwright once:

    npm install --no-save playwright@1.56.1 @axe-core/playwright
    npx playwright install chromium
    node tests/browser-check.cjs
    node tests/ai-browser-check.cjs

Both browser suites target https://leaflight-reader.vercel.app by default; override with BASE_URL.

## Browser QA
Install Playwright locally for optional end-to-end checks against the deployed site:

    npm install --no-save playwright
    npx playwright install chromium
    node tests/browser-check.cjs

These checks cover desktop and iPhone-sized navigation, book searching, saving, reading, progress persistence, reading settings, and layout overflow.

## Deploy
Import this GitHub repository into Vercel. The root is a static site with two Node.js serverless routes in /api. No database or environment variables needed.

## Privacy
This app does not collect account information. Saved books and reading progress stay in localStorage on the current device; clearing browser data removes them. External catalog and text hosts necessarily receive network requests.

## Reader QA and design
Leaflight's immersive reading view follows familiar **Kindle-like reader patterns**: distraction-free paper layout, serif and sans fonts, warm/dark color modes, line-spacing and page-margin controls, a reading-position slider, page-step navigation, bookmarks, and keyboard navigation. It does not copy Kindle branding, graphics, or source code.

Run the comprehensive tests after installing Playwright and its Chromium browser:

    npm test
    npm run check
    BASE_URL=https://leaflight-reader.vercel.app node tests/browser-check.cjs
    BASE_URL=https://leaflight-reader.vercel.app node tests/ai-browser-check.cjs
    BASE_URL=https://leaflight-reader.vercel.app node tests/release-audit.cjs

For reproducible network-error and race-condition testing, start a local test server (which uses synthetic public-domain test text when the stress tests intercept requests):

    node tests/dev-server.cjs
    node tests/reader-stress.cjs
    node tests/edge-audit.cjs
    node tests/races-audit.cjs
    node tests/storage-audit.cjs
    node tests/mobile-reader-audit.cjs

The catalog is a snapshot, not a live complete inventory; some titles only support opening their Project Gutenberg edition. Saving progress is per browser/device, without an account.

### Long-book performance and accessibility

Long Gutenberg editions are divided into small, independently laid-out sections. Full text remains available, but offscreen sections don't require expensive reflow when the reader font size, spacing, or margins change. Run `node tests/long-book-performance.cjs` against a local development server to stress-test an approximately 3.35 MB synthetic book on desktop and mobile.

Run `node tests/accessibility-regression.cjs` to audit WCAG A/AA issues on desktop and mobile, including all reader themes and the settings panel. It uses `@axe-core/playwright`; automated checking does not replace manual accessibility review.

### Book interior typography

The reader identifies recognizable Project Gutenberg chapter, part, section,
subtitle and scene-break markers. Chapter titles use display-serif typography,
chapter numbers use compact sans-serif labels, and table-of-contents entries
stay smaller than actual chapter openings. Clearly hard-wrapped prose is
reflowed for small screens, while short verse and specially indented passages
keep their original line breaks. The original source text and whitespace are
preserved in the reader's DOM, aside from normalizing CRLF newlines.

Run `node tests/reader-typography.cjs` against the local development server
to verify the heading hierarchy, mobile styling, text preservation and
bookmark interactions.

### Editorial reading mode

The book view opens at the story instead of the Project Gutenberg license
preamble. Title pages, publisher notes, prefaces and tables of contents remain
available in a disclosure at the start; the full ending/license remains
available in another disclosure at the end. Every character of the fetched
plain-text edition remains in the reading document, even while disclosures
are closed. The publisher's original website remains linked in the toolbar.

The main text uses Literata for long-form prose, Fraunces for title/chapter
headings, and DM Sans for short reader labels. Prose that Gutenberg hard-wraps
at terminal width reflows into paragraphs; short verse keeps line breaks.
A serif/sans toggle, night/sepia themes, bookmarks, position slider and
reading-width controls remain available. Headings are recognized conservatively,
so layout can vary for unusual or poorly scanned public-domain editions.

Run `node tests/reader-typography.cjs` locally to verify the reading styles,
full-text fidelity, source disclosures and mobile behavior. For broader QA, compare real Gutenberg editions with locally downloaded
fixtures to confirm source text and paragraph rendering stay faithful.

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
The searchable catalog comes from [Gutendex](https://gutendex.com/). Actual book text is fetched only when a reader opens a book from [Project Gutenberg](https://www.gutenberg.org/) and displayed with its included licensing notices. Some editions have no plain-text version, and they may be opened at Gutenberg instead. Books are not uploaded to this repository. Most Project Gutenberg texts are freely reusable in the United States, but copyright status can differ internationally. Always check applicable laws.

## Run locally
Install Node 20+ and a local dev server supporting Vercel API routes, such as the Vercel CLI:

    npx vercel dev

Or open the static HTML with a web server to inspect the design; book loading requires the /api/books and /api/read routes.

## Test
    npm test
    npm run check

## Deploy
Import this GitHub repository into Vercel. The root is a static site with two Node.js serverless routes in /api. No database or environment variables needed.

## Privacy
This app does not collect account information. Saved books and reading progress stay in localStorage on the current device; clearing browser data removes them. External catalog and text hosts necessarily receive network requests.

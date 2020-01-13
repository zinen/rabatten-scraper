# Rabatten scraper
Used to scrape data to be used in chrome browser extension [Rabatten](https://github.com/zinen/Rabatten#readme).

Uses [Puppeteer](https://github.com/puppeteer/puppeteer#readme) a library for [Node.js](https://nodejs.org/) to scrape javscript heavy sites.

## How it works
Most sites are scraped like this:
 1. *Login on site (if required)*
 2. Search the main page for each element stating the amount of discount
 3. Search though each elements sub page to find link to remote website (based on data from in step 2) 
 4. Search the external site for the domain name
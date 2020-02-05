# Rabatten scraper
Used to scrape data to be used in chrome browser extension [Rabatten](https://github.com/zinen/Rabatten#readme).

Uses [Puppeteer](https://github.com/puppeteer/puppeteer#readme) a library for [Node.js](https://nodejs.org/) to scrape javscript heavy sites.

## How it works
Most sites are scraped like this:
 1. *Login on site (if required)*
 2. Search the main page for each element stating the amount of discount
 3. Search though each elements sub page to find link to remote website (based on data from in step 2) 
 4. *Optinaly: If link for remote website is the same as the last scrape. Data from the last scrape can be used to dramatically reduce required run time. And thereby not needing to seaching the external site*
 5. Search the external site for the domain name
 
 ### Output data from a scrape
Scraped data is stored as .json in the `./scraped-data/` folder. Including logs/info from scrape. Each new scrape is stored with ISO timestamp as filename.
 
 ### Distribution data
Data is cleaned and parsed to .json, the result is placed in the `./dist/` folder. Data is stored with the same file name at each new scrape and is avalible via [jsDelivr](http://www.jsdelivr.com) links here:
- [forbrugsforeningen.json](https://cdn.jsdelivr.net/gh/zinen/rabatten-scraper@latest/dist/forbrugsforeningen.json)
- [logbuy.json](https://cdn.jsdelivr.net/gh/zinen/rabatten-scraper@latest/dist/logbuy.json)
- [coop.json](https://cdn.jsdelivr.net/gh/zinen/rabatten-scraper@latest/dist/coop.json)
- [aeld.json](https://cdn.jsdelivr.net/gh/zinen/rabatten-scraper@latest/dist/aeld.json)
 

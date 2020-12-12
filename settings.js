'use strict'
module.exports = {
  holderService: [
    {
      name: 'test',
      scrapeOutPath: './scraped-data/test/'
    },
    {
      name: 'forbrugsforeningen',
      scrapeOutPath: './scraped-data/forb/',
      distOutFile: 'forbrugsforeningen.json'
    },
    {
      name: 'logbuy',
      scrapeOutPath: './scraped-data/logb/',
      distOutFile: 'logbuy.json'
    },
    {
      name: 'coop',
      scrapeOutPath: './scraped-data/coop/',
      distOutFile: 'coop.json'
    },
    {
      name: 'aeldresagen',
      scrapeOutPath: './scraped-data/aeld/',
      distOutFile: 'aeld.json'
    }
  ]
}

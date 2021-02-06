/* global doTestScrape, doForbrugScrape, doLogbuyScrape, doCoopScrape, doAeldreScrape */
'use strict'
module.exports = {
  holderService: {
    test: {
      name: 'test',
      scrapeOutPath: './scraped-data/test/',
      scrapeModule: 'doTestScrape.js',
      scrapeFunc () { doTestScrape() }
    },
    forbrugsforeningen: {
      name: 'Forbrugsforeningen',
      scrapeOutPath: './scraped-data/forb/',
      scrapeModule: 'doForbrugScrape.js',
      scrapeFunc () { doForbrugScrape() },
      distOutFile: 'forbrugsforeningen.json'
    },
    logbuy: {
      name: 'LogBuy',
      scrapeOutPath: './scraped-data/logb/',
      scrapeModule: 'doLogbuyScrape.js',
      scrapeFunc () { doLogbuyScrape() },
      distOutFile: 'logbuy.json'
    },
    coop: {
      name: 'Coop partnerfordele',
      scrapeOutPath: './scraped-data/coop/',
      scrapeModule: 'doCoopScrape.js',
      scrapeFunc () { doCoopScrape() },
      distOutFile: 'coop.json'
    },
    aeldresagen: {
      name: 'Ældre Sagen',
      scrapeOutPath: './scraped-data/aeld/',
      scrapeModule: 'doAeldreScrape.js',
      scrapeFunc () { doAeldreScrape() },
      distOutFile: 'aeld.json'
    },
    /**
     * Get services
     * @returns {array} Array of services
     */
    getServices (inputKey = null, ignoreKey = 'test') {
      const keys = Object.keys(this)
      for (let index = keys.length - 1; index > -1; index--) {
        const serviceKey = keys[index]
        if (typeof this[serviceKey] === 'function' || serviceKey === ignoreKey) {
          keys.splice(index, 1)
          continue
        }
        if (inputKey) {
          keys[index] = this[serviceKey][inputKey]
        }
      }
      return keys
    },
    /**
     * Get services as object
     * @param {*} inputKey input key
     * @param {string} [ignoreKey='test'] ignore this key in output
     * @returns {object} Object of service as a key and inputKey as value
     */
    getServiceObject (inputKey, ignoreKey = 'test') {
      const keys = Object.keys(this)
      for (let index = keys.length - 1; index > -1; index--) {
        const serviceKey = keys[index]
        if (typeof this[serviceKey] === 'function' || serviceKey === ignoreKey) {
          keys.splice(index, 1)
          continue
        }
        keys[index] = { name: serviceKey, value: this[serviceKey][inputKey] }
      }
      return keys
    }
  }

}

'use strict'

// Some data from earlier scrape. Nothing special about it
const testDataArray = [
  {
    name: 'YX Fyringsolie',
    localLink: 'https://www.forbrugsforeningen.dk/businesssearch//70030',
    discount: '1,8 %',
    remoteLink: 'www.fyringsolie.dk',
    masterData: true
  },
  {
    name: 'Louiliana Børnemode',
    localLink: 'https://www.forbrugsforeningen.dk/businesssearch/1002076129',
    discount: '9 % ',
    err3: 'No link to external site was found on local element page'
  },
  {
    name: 'Night of Freestyle',
    localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002376942',
    discount: '8 %',
    remoteLink0: 'http://www.fbfb.dk',
    remoteLink: 'fbfb.dk'
  },
  {
    name: 'Mens Closet',
    localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002371772',
    discount: '10 %',
    remoteLink0: 'http://www.menscloset.dk',
    remoteLink: 'menscloset.dk'
  }
]

/**
 * Perform scape of data
 * @param {Object} PupPool Puppeteer pool
 * @param {[{Object}]} [masterData=null] Optional array containing objects with earlier results
 * @param {Function} returnDataToMainThread Callback function called on every successfully scrape
 * @param {string} saveDataKey Optional string returned as first argument in callback above
 * @returns Nothing
 */
async function doTestScrape (PupPool = null, masterData = null, returnDataToMainThread, saveDataKey = 'empty') {
  for (const dataPoint of testDataArray) {
    returnDataToMainThread('forbrugsforeningen', dataPoint)
  }
}

exports.doTestScrape = doTestScrape

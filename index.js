'use strict'
const { doForbrugScrape } = require('./modules/doForbrugScrape.js')
const { doLogbuyScrape } = require('./modules/doLogbuyScrape.js')
const { doCoopScrape } = require('./modules/doCoopScrape.js')
// const my = require('./modules/my_filesystem.js')
const my = require('../common-zinen/index.js')
const { lastFileContent } = require('../common-zinen/index.js')
require('dotenv').config()

let browserHolder

/**
 * Run analys on last last file in dir, sorted by name.
 * @param {string} filePath File path to do search in dir.
 * @returns {Promise<Object>} Content of the file after analasys.
 */
async function analyseData (filePath) {
  const data = JSON.parse(await lastFileContent(filePath))
  console.log('Length of data: ' + data.length)
  const lengthData = data.length
  let i1 = 0
  let i2 = 0
  let iSame = 0
  let iDif = 0
  let iNone = 0
  // Clean links:
  data.forEach(point => {
    point.remoteLink0 = point.remoteLink0 ? point.remoteLink0.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase() : null
    point.remoteLink = point.remoteLink ? point.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1') : null
    if (!point.remoteLink) {
      point.remoteLinkResult = 'none'
      iNone++
    } else if (point.remoteLink0 === point.remoteLink) {
      point.remoteLinkResult = 'same'
      iSame++
    } else {
      point.remoteLinkResult = 'diff'
      iDif++
    }
    i1 += point.err1 ? 1 : 0
    i2 += point.err2 ? 1 : 0
  })
  // Add notes to files
  data.push({
    name: '_analyse',
    length: lengthData,
    countErr1: i1,
    countErr2: i2,
    countSame: iSame,
    countDif: iDif,
    countNone: iNone,
    timestamp: new Date().toISOString()
  })
  return data
}

async function returnErrors (filePath) {
  const data = JSON.parse(await lastFileContent(filePath))
  const newData = []
  for (const point of data) {
    if ((point.err2 || point.err1 || point.err3 || point.err4) && !point.remoteLink) {
      // Keep this data
      newData.push(point)
    } else {
      // Dont keep this data
    }
  }
  return newData
}

const holderService = [
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
  }
]

async function makeDistData () {
  // Format: Array, containing arrays of ..
  // [Remote link, company name, discount amount, local link]
  const outputFilePath = './dist/'
  for await (const service of holderService) {
    try {
      const holder = []
      const lastScrapedData = JSON.parse(await lastFileContent(service.scrapeOutPath))
      for await (const dataPoint of lastScrapedData) {
        if (dataPoint.name && dataPoint.localLink && dataPoint.discount && dataPoint.remoteLink) {
          const URL = dataPoint.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase()
          holder.push([URL, dataPoint.name, dataPoint.discount, dataPoint.localLink])
        }
      }
      await my.writeFile(outputFilePath + service.distOutFile, JSON.stringify(holder))
    } catch (error) {
      console.log('--Error---')
      console.log(error)
      console.log('---------')
    }
  }
}

// TODO:Convert to data expeted by rabatten
(async () => {
  const startTime = new Date().toISOString()
  const runForbrugScrape = false
  const runLogbuyScrape = false
  const runCoopScrape = false
  const runAnalys = false
  const onlyErrors = false
  const saveResult = false
  const makeDist = true
  let filePath = './scraped-data/test/'
  let result
  if (makeDist) {
    makeDistData()
    return
  } else if (runForbrugScrape) {
    filePath = './scraped-data/forb/'
    const lastScrapedData = JSON.parse(await lastFileContent(filePath))
    result = await doForbrugScrape(browserHolder, lastScrapedData)
  } else if (runLogbuyScrape) {
    filePath = './scraped-data/logb/'
    const lastScrapedData = JSON.parse(await lastFileContent(filePath))
    // lastScrapedData not testet yet
    result = await doLogbuyScrape(browserHolder, lastScrapedData)
  } else if (runCoopScrape) {
    filePath = './scraped-data/coop/'
    const lastScrapedData = JSON.parse(await lastFileContent(filePath))
    result = await doCoopScrape(browserHolder, lastScrapedData)
  } else if (runAnalys) {
    result = await analyseData(filePath)
  } else if (onlyErrors) {
    result = await returnErrors(filePath)
  }
  if (saveResult) {
    if (!result) { throw new Error('No screaped data to save') }
    const date = new Date().toISOString() // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
    const jsonContent = JSON.stringify(result, null, 2) // Convert to JSON
    const datestring = date.replace(/:/g, '').split('.')[0] // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
    const setFilename = filePath + datestring + '.json'
    await my.writeFile(setFilename, jsonContent)
  }
  // Print to console both start and finish time
  console.log('Script ran from ' + startTime + ' to ' + new Date().toISOString())
})()

// Before time loop 2,671
// Async (2xawait)for loop 2,089
// Async generator 2,064

// Test fetch:
// const resonse = await fetch('https://www.mylogbuy.com/WebPages/Redirects/BuyOrder.aspx?dealid=34940')
// console.log(await resonse.text())

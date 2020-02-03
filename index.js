'use strict'
const { doForbrugScrape } = require('./modules/doForbrugScrape.js')
const { doLogbuyScrape } = require('./modules/doLogbuyScrape.js')
const { doCoopScrape } = require('./modules/doCoopScrape.js')
const { doAeldreScrape } = require('./modules/doAeldreScrape.js')
const my = require('../common-zinen/index.js')
const { lastFileContent } = require('../common-zinen/index.js')
require('dotenv').config()
const inquirer = require('inquirer')

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
  let i3 = 0
  let i4 = 0
  let iSame = 0
  let iDif = 0
  let iNone = 0
  const occurHolder = {}
  data.forEach(point => {
    if (!point.remoteLink) {
      point.remoteLinkResult = 'none'
      iNone++
    } else {
      // Clean links:
      point.remoteLink0 = point.remoteLink0 ? point.remoteLink0.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase() : null
      point.remoteLink = point.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1')
      if (point.remoteLink0 === point.remoteLink) {
        point.remoteLinkResult = 'same'
        iSame++
      } else {
        point.remoteLinkResult = 'diff'
        iDif++
      }
      if (occurHolder[point.remoteLink]) {
        occurHolder[point.remoteLink]++
      } else {
        occurHolder[point.remoteLink] = 1
      }
    }
    i1 += point.err1 ? 1 : 0
    i2 += point.err2 ? 1 : 0
    i3 += point.err3 ? 1 : 0
    i4 += point.err4 ? 1 : 0
  })
  // Count re-occurrences of a a remnoteLink
  const keys = Object.keys(occurHolder)
  for (const key of keys) {
    // 3 or more re-occurrences is relevant
    if (occurHolder[key] < 3) {
      delete occurHolder[key]
    }
  }

  // Add notes to files
  data.push({
    name: '_analyse',
    length: lengthData,
    countErr1: i1,
    countErr2: i2,
    countErr3: i3,
    countErr4: i4,
    countSame: iSame,
    countDif: iDif,
    countNone: iNone,
    countOccur: occurHolder,
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
  },
  {
    name: 'aeldresagen',
    scrapeOutPath: './scraped-data/aeld/',
    distOutFile: 'aeld.json'
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

var questions = [
  {
    type: 'list',
    name: 'action',
    message: 'Action to perform?',
    choices: ['Scrape data from web', 'Analyse ealier data scraped', 'Build distribution']
  },
  {
    type: 'list',
    name: 'scrapeThis',
    message: 'Where to scrape data from?',
    choices: ['Forbrugsforeningen', 'Logbuy', 'Coop', 'Aeldresagen'],
    filter: function (val) {
      return val.toLowerCase()
    },
    when: async function (answers) {
      return answers.action === 'Scrape data from web'
    }
  },
  // {
  //   type: 'confirm',
  //   name: 'scrapeMasterData',
  //   message: 'Allow the scrape to reley on eairler scrapes result?',
  //   default: true,
  //   when: async function (answers) {
  //     return answers.action === 'Scrape data from web'
  //   }
  // },
  {
    type: 'list',
    name: 'analyseThis',
    message: 'Which analyse to run?',
    choices: ['Look though all data', 'Return only data with errors'],
    when: function (answers) {
      return answers.action === 'Analyse ealier data scraped'
    }
  }]

async function saveScrape (input, filePath) {
  if (input) {
    const date = new Date().toISOString() // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
    const jsonContent = JSON.stringify(input, null, 2) // Convert to JSON
    const datestring = date.replace(/:/g, '').split('.')[0] // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
    const setFilename = filePath + datestring + '.json'
    await my.writeFile(setFilename, jsonContent)
  } else {
    console.log('No data to save')
  }
}

// TODO:Convert to data expeted by rabatten
async function init () {
  const answers = await inquirer.prompt(questions)
  // const answers = {
  //   action: 'Scrape data from web',
  //   scrapeThis: 'aeldresagen',
  //   scrapeMasterData: true
  // }
  console.log(JSON.stringify(answers, null, '  '))
  const startTime = new Date().toISOString()
  let filePath = './scraped-data/test/'
  let result
  if (answers.action === 'Build distribution') {
    makeDistData()
    return
  } else if (answers.scrapeThis === 'forbrugsforeningen') {
    filePath = './scraped-data/forb/'
    const lastScrapedData = JSON.parse(await lastFileContent(filePath))
    result = await doForbrugScrape(browserHolder, lastScrapedData)
  } else if (answers.scrapeThis === 'logbuy') {
    filePath = './scraped-data/logb/'
    const lastScrapedData = JSON.parse(await lastFileContent(filePath))
    result = await doLogbuyScrape(browserHolder, lastScrapedData)
  } else if (answers.scrapeThis === 'coop') {
    filePath = './scraped-data/coop/'
    const lastScrapedData = JSON.parse(await lastFileContent(filePath))
    result = await doCoopScrape(browserHolder, lastScrapedData)
  } else if (answers.scrapeThis === 'aeldresagen') {
    filePath = './scraped-data/aeld/'
    const lastScrapedData = JSON.parse(await lastFileContent(filePath))
    result = await doAeldreScrape(browserHolder, lastScrapedData)
  } else if (answers.analyseThis === 'Look though all data') {
    result = await analyseData(filePath)
  } else if (answers.analyseThis === 'Return only data with errors') {
    result = await returnErrors(filePath)
  }
  saveScrape(result, filePath)
  // Print to console both start and finish time
  console.log('Script ran from ' + startTime + ' to ' + new Date().toISOString())
}
// init()

async function runAll () {
  let filePath = './scraped-data/forb/'
  let lastScrapedData = JSON.parse(await lastFileContent(filePath))
  let result = await doForbrugScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
  filePath = './scraped-data/logb/'
  lastScrapedData = JSON.parse(await lastFileContent(filePath))
  result = await doLogbuyScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
  filePath = './scraped-data/coop/'
  lastScrapedData = JSON.parse(await lastFileContent(filePath))
  result = await doCoopScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
  filePath = './scraped-data/aeld/'
  lastScrapedData = JSON.parse(await lastFileContent(filePath))
  result = await doAeldreScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
  await makeDistData()
  console.log(new Date().toISOString() + ' Runing all scrapes ended')
}

// Deside how to run code
if (process.argv.length > 2 && process.argv[2].toLowerCase() === 'all') {
  console.log(new Date().toISOString() + ' Runing all scrapes now')
  runAll()
} else {
  init()
}

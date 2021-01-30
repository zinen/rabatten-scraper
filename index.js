'use strict'
const { doForbrugScrape } = require('./modules/doForbrugScrape.js')
const { doLogbuyScrape } = require('./modules/doLogbuyScrape.js')
const { doCoopScrape } = require('./modules/doCoopScrape.js')
const { doAeldreScrape } = require('./modules/doAeldreScrape.js')
// const { doTestScrape } = require('./modules/doTestScrape.js')
const myFunc = require('./modules/myFunc.js')
// const { lastFileContent, readDir, readFile } = require('./modules/myFunc.js')
require('dotenv').config()
const inquirer = require('inquirer')
const { initPuppeteerPool } = require('./modules/puppeteer-pool.js')
const { holderService } = require('./settings.js')
const startTime = new Date().toISOString()

// Returns a generic-pool instance
const pool = initPuppeteerPool({
  max: 5,
  min: 0,
  // how long a resource can stay idle in pool before being removed
  idleTimeoutMillis: 30000, // default.
  // maximum number of times an individual resource can be reused before being destroyed; set to 0 to disable
  maxUses: 10,
  // function to validate an instance prior to use; see https://github.com/coopernurse/node-pool#createpool
  validator: () => Promise.resolve(true), // defaults to always resolving true
  // validate resource before borrowing; required for `maxUses and `validator`
  testOnBorrow: true, // default
  // For all opts, see opts at https://github.com/coopernurse/node-pool#createpool
  puppeteerArgs: {
    // headless: false, // default is true
    // slowMo: 50, // only for debugging
    devtools: false, // default is false
    ignoreHTTPSErrors: true, // default is false
    args: [
      '--disable-infobars',
      // '--window-position=960,10',
      '--ignore-certificate-errors',
      '--ignore-certificate-errors-spki-list',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      // '--window-size=1280x800',
      // '--hide-scrollbars',
      '--lang=da-DK',
      '--disable-notifications',
      '--disable-extensions'
    ]

  }
})

/**
 * Analyse the last last file in dir, sorted by name.
 * @param {string} filePath File path to do search in dir.
 * @returns {Promise<Object>} Content of the file after analyses.
 */
async function analyseData (filePath) {
  const data = JSON.parse(await myFunc.lastFileContent(filePath))
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
  // Count re-occurrences of a a remoteLink
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

/**
 * Return data points with errors in
 * @param {string} filePath File path to do search in dir.
 * @returns {Promise<Object>} Content of the file after analyses.
 */
async function returnErrors (filePath) {
  const data = JSON.parse(await myFunc.lastFileContent(filePath))
  const newData = []
  for (const point of data) {
    if ((point.err2 || point.err1 || point.err3 || point.err4) && !point.remoteLink) {
      // Keep this data
      newData.push(point)
    } else {
      // don't keep this data
    }
  }
  return newData
}

/**
 * Compare the 2 newest data scrapes
 * @param {string} filePath File path to do search in dir.
 * @returns {Promise<Object>} Content of the file after analyses.
 */
async function compareLast (filePath) {
  const dirContent = await myFunc.readDir(filePath)
  if (dirContent.length > 1) {
    console.log('Comparing 2 newest file content now')
    const newestData = JSON.parse(await myFunc.readFile(dirContent[dirContent.length - 1]))
    const oldestData = JSON.parse(await myFunc.readFile(dirContent[dirContent.length - 2]))
    const newestLength = newestData.length
    const oldestLength = oldestData.length
    const newLinkArray = []
    for (let index = newestData.length - 1; index >= 0; index--) {
      const element = newestData[index]
      for (let index2 = oldestData.length - 1; index2 >= 0; index2--) {
        const element2 = oldestData[index2]
        if (element.name === element2.name) {
          if (element.remoteLink && element2.remoteLink) {
            const URL1 = element.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase()
            const URL2 = element2.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase()
            if (URL1 !== URL2) {
              newLinkArray.push({
                name: element.name,
                from: URL2,
                to: URL1
              })
            }
          }
          newestData.splice(index, 1)
          oldestData.splice(index2, 1)
          break
        }
      }
    }
    return {
      newServices: newestData,
      removedServices: oldestData,
      newLink: newLinkArray,
      _analyse: {
        oldFile: dirContent[dirContent.length - 2],
        oldFileLength: oldestLength,
        newFile: dirContent[dirContent.length - 1],
        newFileLength: newestLength,
        removedLength: oldestData.length,
        addedLength: newestData.length,
        timestamp: new Date().toISOString()
      }
    }
  } else {
    console.log(`Comparing require multiple files, ${dirContent.length} was found`)
  }
}

async function makeDistData () {
  // Format: Array, containing arrays of ..
  // [Remote link, company name, discount amount, local link]
  const outputFilePath = './dist/'
  for await (const service of holderService.getServices()) {
    // Skip test part of holderService
    if (service.name === 'test') { continue }
    try {
      const holder = []
      const lastScrapedData = JSON.parse(await myFunc.lastFileContent(holderService[service].scrapeOutPath))
      for await (const dataPoint of lastScrapedData) {
        if (dataPoint.name && dataPoint.localLink && dataPoint.discount && dataPoint.remoteLink) {
          let URL = dataPoint.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase()
          // Copied from chrome extension app v1.1.1
          URL = URL.split('.')
          if (URL[URL.length - 1] === 'uk') {
            // Fix for uk domains, cant handel domain suffixes with only ".uk" but will handle domains like ".co.uk"
            URL = URL.slice(-3).join('.')
          } else {
            URL = URL.slice(-2).join('.')
          }
          // Copy done
          holder.push([URL, dataPoint.name, dataPoint.discount, dataPoint.localLink])
        }
      }
      await myFunc.writeFile(outputFilePath + holderService[service].distOutFile, JSON.stringify(holder))
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
    choices: ['Scrape data from web', 'Analyse earlier data scraped', 'Build distribution']
  },
  {
    type: 'list',
    name: 'scrapeService',
    message: 'Where to scrape data from?',
    choices: holderService.getServices(),
    // [holderService[1].name, holderService[2].name, holderService[3].name, holderService[4].name, 'All'],
    filter: function (val) {
      return val.toLowerCase()
    },
    when: async function (answers) {
      return answers.action === 'Scrape data from web'
    }
  },
  {
    type: 'confirm',
    name: 'scrapeMasterData',
    message: 'Allow the scrape to rely on earlier scrapes result?',
    default: true,
    when: async function (answers) {
      return answers.action === 'Scrape data from web'
    }
  },
  {
    type: 'list',
    name: 'analyseAction',
    message: 'Which analyse to run?',
    choices: ['Look though all data', 'Return only data with errors', 'Compare with last'],
    when: function (answers) {
      return answers.action === 'Analyse earlier data scraped'
    }
  },
  {
    type: 'list',
    name: 'analyseService',
    message: 'Where to analyse data from?',
    choices: holderService.getServiceObject('scrapeOutPath', null),

    // [
    //   { name: holderService[0].name, value: holderService[0].scrapeOutPath },
    //   { name: holderService[1].name, value: holderService[1].scrapeOutPath },
    //   { name: holderService[2].name, value: holderService[2].scrapeOutPath },
    //   { name: holderService[3].name, value: holderService[3].scrapeOutPath },
    //   { name: holderService[4].name, value: holderService[4].scrapeOutPath }
    // ],
    when: async function (answers) {
      return answers.action === 'Analyse earlier data scraped'
    }
  }
]

const savedDataFromScrape = {}
async function saveFromScrape (service = 'empty', data = {}) {
  // If object does not contain the key of content of service, make an array before pushing data
  if (!Object.prototype.hasOwnProperty.call(savedDataFromScrape, service)) {
    savedDataFromScrape[service] = []
  }
  savedDataFromScrape[service].push(data)
}

async function prepareSaveToFile (inputData = { empty: [] }) {
  // console.log('inputData keys', Object.keys(inputData))
  for (const service of Object.keys(inputData)) {
    if (Object.prototype.hasOwnProperty.call(holderService, service)) {
      saveToFile(inputData[service], holderService[service].scrapeOutPath)
    } else {
      saveToFile(inputData[service], holderService.test.scrapeOutPath)
    }
  }
}

async function poolWatcher () {
  async function delay (msSec) {
    return new Promise(resolve => {
      setTimeout(() => resolve('DelayTimeout'), msSec)
    })
  }
  // Fix: sometimes before a job is finished and before just before a new one is
  //  pending this while loop just went false. Looking at saved data fixes this.
  let timeout = 10 // Timeout in seconds
  while (timeout > 0 && Object.keys(savedDataFromScrape).length === 0) {
    await delay(1000)
    timeout--
  }
  console.log('Startup timeout ended, watching pool now.')

  while (pool.borrowed > 0 || pool.pending > 0) {
    console.log(`Pool is still working. Active: ${pool.borrowed}, pending: ${pool.pending}`)
    await delay(17000)
  }
  console.log('Puppeteer pool is not in use anymore. Draining pool now.')
  pool.drain().then(() => pool.clear())
  await prepareSaveToFile(savedDataFromScrape)
  if (makeDistOnDone) { makeDistData() }
  console.log('Script ran from ' + startTime + ' to ' + new Date().toISOString())
}

async function saveToFile (input, filePath) {
  if (input) {
    const date = new Date().toISOString() // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
    const jsonContent = JSON.stringify(input, null, 2) // Convert to JSON
    const dateString = date.replace(/:/g, '').split('.')[0] // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
    const setFilename = filePath + dateString + '.json'
    await myFunc.writeFile(setFilename, jsonContent)
  } else {
    console.log('No data to save to ' + filePath)
  }
}

async function run () {
  const answers = await inquirer.prompt(questions)
  // const answers =
  // {
  //   action: 'Scrape data from web',
  //   scrapeService: 'coop',
  //   scrapeMasterData: false
  // }

  console.log(JSON.stringify(answers, null, '  '))

  let filePath = './scraped-data/test/'
  let result
  if (answers.action === 'Build distribution') {
    makeDistData()
  } else if (answers.action === 'Analyse earlier data scraped') {
    switch (answers.analyseAction) {
      case 'Look though all data':
        result = await analyseData(answers.analyseService)
        break
      case 'Return only data with errors':
        result = await returnErrors(answers.analyseService)
        break
      case 'Compare with last':
        result = await compareLast(answers.analyseService)
        break
    }
    saveToFile(result, filePath)
  } else if (answers.scrapeService === 'all') {
    runAll(answers.scrapeMasterData)
  } else if (answers.action === 'Scrape data from web') {
    let lastScrapedData
    filePath = holderService[answers.scrapeService].scrapeOutPath
    if (answers.scrapeService === 'forbrugsforeningen') {
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      // doTestScrape(pool, lastScrapedData, saveFromScrape, answers.scrapeService)
      doForbrugScrape(pool, lastScrapedData, saveFromScrape, answers.scrapeService)
    } else if (answers.scrapeService === 'logbuy') {
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      doLogbuyScrape(pool, lastScrapedData, saveFromScrape, answers.scrapeService)
    } else if (answers.scrapeService === 'coop') {
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      doCoopScrape(pool, lastScrapedData, saveFromScrape, answers.scrapeService)
    } else if (answers.scrapeService === 'aeldresagen') {
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      doAeldreScrape(pool, lastScrapedData, saveFromScrape, answers.scrapeService)
    }
    poolWatcher()
  } else {
    throw new Error('No choices matched anything')
  }
}

async function initForb (masterData) {
  const filePath = holderService.forbrugsforeningen.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  doForbrugScrape(pool, lastScrapedData, saveFromScrape, 'forbrugsforeningen')
}

async function initLogb (masterData) {
  const filePath = holderService.logbuy.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  doLogbuyScrape(pool, lastScrapedData, saveFromScrape, 'logbuy')
}

async function initCoop (masterData) {
  const filePath = holderService.coop.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  doCoopScrape(pool, lastScrapedData, saveFromScrape, 'coop')
}

async function initAeld (masterData) {
  const filePath = holderService.aeldresagen.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  doAeldreScrape(pool, lastScrapedData, saveFromScrape, 'aeldresagen')
}

let makeDistOnDone = false
async function runAll (masterData = true) {
  console.log(new Date().toISOString() + ' Running all scrapes now')
  makeDistOnDone = true
  initForb(masterData)
  initLogb(masterData)
  initCoop(masterData)
  initAeld(masterData)
  poolWatcher()
}

// Decide how to run code
if (process.argv.length > 2 && process.argv[2].toLowerCase() === 'all') {
  runAll()
} else {
  run()
  // console.log(holderService.getServiceScrapeObject('name'))
}

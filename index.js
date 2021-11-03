'use strict'
const { doForbrugScrape } = require('./modules/doForbrugScrape.js')
const { doLogbuyScrape } = require('./modules/doLogbuyScrape.js')
const { doCoopScrape } = require('./modules/doCoopScrape.js')
const { doAeldreScrape } = require('./modules/doAeldreScrape.js')
// const { doTestScrape } = require('./modules/doTestScrape.js')
const myUtil = require('./utils/my-utilities.js')
require('dotenv').config()
const inquirer = require('inquirer')
const { initPuppeteerPool } = require('./modules/my-puppeteer.js')
const { holderService } = require('./settings.js')
const startTime = new Date().toISOString()
const EventEmitter = require('events')
global.eventEmitter = new EventEmitter()
const holder = {
  jobsActive: 0,
  jobQueueDone: []
}

global.eventEmitter.addListener('jobFinished', (jobInfo = null) => {
  // Subtract a number from the job queue
  holder.jobsActive--
  if (jobInfo) {
    holder.jobQueueDone.push(jobInfo)
  }
  if (holder.jobsActive === 0 ) {
    poolWatcher()
  }
})

// Returns a generic-pool instance
const pool = initPuppeteerPool()

/**
 * Analyse the last last file in dir, sorted by name.
 * @param {string} filePath File path to do search in dir.
 * @returns {Promise<Object>} Content of the file after analyses.
 */
async function analyseData (filePath) {
  const data = JSON.parse(await myUtil.lastFileContent(filePath))
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
  const data = JSON.parse(await myUtil.lastFileContent(filePath))
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
  const dirContent = await myUtil.readDir(filePath)
  if (dirContent.length > 1) {
    console.log('Comparing 2 newest file content now')
    const newestData = JSON.parse(await myUtil.readFile(dirContent[dirContent.length - 1]))
    const oldestData = JSON.parse(await myUtil.readFile(dirContent[dirContent.length - 2]))
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
      const lastScrapedData = JSON.parse(await myUtil.lastFileContent(holderService[service].scrapeOutPath))
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
      await myUtil.writeFile(outputFilePath + holderService[service].distOutFile, JSON.stringify(holder))
    } catch (error) {
      console.log('--Error---')
      console.log(error)
      console.log('---------')
    }
  }
}

holder.savedDataFromScrape = {}
async function saveFromScrape (service = 'empty', data = {}) {
  // If object does not contain the key of content of service, make an array before pushing data
  if (!Object.prototype.hasOwnProperty.call(holder.savedDataFromScrape, service)) {
    holder.savedDataFromScrape[service] = []
  }
  holder.savedDataFromScrape[service].push(data)
  // As this function should get called during active scraps. Reset watchdog timer on call
  if (holder.poolWatching) { holder.activityTimer.refresh() }
}

async function prepareSaveToFile (inputData = { empty: [] }) {
  for (const service of Object.keys(inputData)) {
    if (Object.prototype.hasOwnProperty.call(holderService, service)) {
      await saveToFile(inputData[service], holderService[service].scrapeOutPath)
    } else {
      await saveToFile(inputData[service], holderService.test.scrapeOutPath)
    }
  }
}

holder.watchdogTimer = setTimeout(() => {
  console.warn('watchdogTimer timeout starting gently stop of process')
  poolWatcher()
  setTimeout(() => {
    console.error('watchdogTimer hard terminating process')
    process.exit(1)
  }, 2 * 60 * 1000)
}, 45 * 60 * 1000) // 2+45 min is the longest run time allowed
// Unref makes node process end even if this timer has not fired
holder.watchdogTimer.unref()

async function poolWatcher () {
  // Dont alow for multible pool watcher beeing run
  if ( holder.poolWatching ) { return }
  holder.poolWatching = true
  console.log('Pool watcher started, watching now.')
  holder.activityTimer = setTimeout(() => {
    console.error('Timeout ended process. Amount of jobs not done:', holder.jobsActive)
    console.error('Registered finished jobs are:', holder.jobQueueDone)
    holder.activityTimerTimeout = true
  }, 60 * 1000)

  while ((pool.borrowed > 0 || pool.pending > 0) && !holder.activityTimerTimeout) {
    console.log(`Pool is still working. Active: ${pool.borrowed}, pending: ${pool.pending}`)
    await myUtil.delay(3000)
  }
  if (holder.activityTimerTimeout) {
    console.error('Watchdog timer timeout; forcing pool draining now.')
  } else {
    console.log('Puppeteer pool is not in use anymore. Draining pool now.')
    clearTimeout(holder.activityTimer)
  }
  pool.drain().then(() => pool.clear())
  await prepareSaveToFile(holder.savedDataFromScrape)
  if (holder.makeDistOnDone) { makeDistData() }
  console.log('Script ran from ' + startTime + ' to ' + new Date().toISOString())
}

async function saveToFile (input, filePath) {
  try {
    if (input) {
      const date = new Date().toISOString() // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
      const jsonContent = JSON.stringify(input, null, 2) // Convert to JSON
      const dateString = date.replace(/:/g, '').split('.')[0] // Get UTC timestamp e.g. 2019-11-13T114410 for scarped at 12:44:10 23'th november 2019
      const setFilename = filePath + dateString + '.json'
      await myUtil.writeFile(setFilename, jsonContent)
    } else {
      console.log('No data to save to ' + filePath)
    }
  } catch (error) {
    console.log(error)
    console.log('Data input', input)
    console.log('filePath input', filePath)
  }
}

async function runInquirer () {
  const questions = [
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
      when: async function (answers) {
        return answers.action === 'Analyse earlier data scraped'
      }
    }
  ]
  const answers = await inquirer.prompt(questions)
  // const answers =
  // {
  //   action: 'Scrape data from web',
  //   scrapeService: 'aeldresagen',
  //   scrapeMasterData: true
  // }

  console.log('inquirer answers noted:', JSON.stringify(answers, null, '  '))
  if (answers.action === 'Build distribution') {
    makeDistData()
  } else if (answers.action === 'Analyse earlier data scraped') {
    let result
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
    saveToFile(result, './scraped-data/test/')
  } else if (answers.scrapeService === 'all') {
    runAll(answers.scrapeMasterData)
  } else if (answers.action === 'Scrape data from web') {
    switch (answers.scrapeService) {
      case 'forbrugsforeningen':
        initForb(answers.scrapeMasterData)
        break
      case 'logbuy':
        initLogb(answers.scrapeMasterData)
        break
      case 'coop':
        initCoop(answers.scrapeMasterData)
        break
      case 'aeldresagen':
        initAeld(answers.scrapeMasterData)
        break
    }
  } else {
    throw new Error('No choices matched anything')
  }
}

async function initForb (masterData = true) {
  const filePath = holderService.forbrugsforeningen.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myUtil.lastFileContent(filePath)) : null
  doForbrugScrape(pool, lastScrapedData, saveFromScrape, 'forbrugsforeningen')
  holder.jobsActive++
}

async function initLogb (masterData = true) {
  const filePath = holderService.logbuy.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myUtil.lastFileContent(filePath)) : null
  doLogbuyScrape(pool, lastScrapedData, saveFromScrape, 'logbuy')
  holder.jobsActive++
}

async function initCoop (masterData = true) {
  const filePath = holderService.coop.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myUtil.lastFileContent(filePath)) : null
  doCoopScrape(pool, lastScrapedData, saveFromScrape, 'coop')
  holder.jobsActive++
}

async function initAeld (masterData = true) {
  const filePath = holderService.aeldresagen.scrapeOutPath
  const lastScrapedData = masterData ? JSON.parse(await myUtil.lastFileContent(filePath)) : null
  doAeldreScrape(pool, lastScrapedData, saveFromScrape, 'aeldresagen')
  holder.jobsActive++
}

holder.makeDistOnDone = false
async function runAll (masterData = true) {
  console.log(new Date().toISOString() + ' Running all scrapes now')
  holder.makeDistOnDone = true
  initForb()
  initLogb()
  initCoop()
  initAeld()
}

// Decide how to run code
if (process.argv.length > 2 && process.argv[2].toLowerCase() === 'all') {
  runAll()
} else if (process.argv.length > 2 && process.argv[2].toLowerCase() === 'dist') {
  makeDistData()
} else if (process.argv.length > 2 && holderService.getServices().includes(process.argv[2].toLowerCase())) {
  switch (process.argv[2].toLowerCase()) {
    case 'forbrugsforeningen':
      initForb()
      break
    case 'logbuy':
      initLogb()
      break
    case 'coop':
      initCoop()
      break
    case 'aeldresagen':
      initAeld()
      break
    default:
  }
} else if (process.argv.length > 2) {
  console.log(
`Second argument did not match a known option. Try:
    all - to scrape all and make new distribution files
    dist - to make new distribution files from latest scrapes
    forbrugsforeningen - to scrape forbrugsforeningen
    logbuy - to scrape logbuy
    coop - to scrape coop
    aeldresagen - to scrape aeldresagen
or no argument at all the start inquire.`
  )
  process.exit(1)
} else if (process.env.CI === true) {
  // Make sure CI runs don't require user input even with no arguments
  runAll()
} else {
  runInquirer()
}

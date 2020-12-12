'use strict'
const { doForbrugScrape } = require('./modules/doForbrugScrape.js')
const { doLogbuyScrape } = require('./modules/doLogbuyScrape.js')
const { doCoopScrape } = require('./modules/doCoopScrape.js')
const { doAeldreScrape } = require('./modules/doAeldreScrape.js')
const myFunc = require('./modules/myFunc.js')
// const { lastFileContent, readDir, readFile } = require('./modules/myFunc.js')
require('dotenv').config()
const inquirer = require('inquirer')
const { holderService } = require('./settings.js')

let browserHolder

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
        oldFile: dirContent[dirContent.length - 1],
        oldFileLength: oldestLength,
        newFile: dirContent[dirContent.length - 2],
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
  for await (const service of holderService) {
    // Skip test part of holderService
    if (service.name === 'test') { continue }
    try {
      const holder = []
      const lastScrapedData = JSON.parse(await myFunc.lastFileContent(service.scrapeOutPath))
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
      await myFunc.writeFile(outputFilePath + service.distOutFile, JSON.stringify(holder))
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
    choices: [holderService[1].name, holderService[2].name, holderService[3].name, holderService[4].name, 'All'],
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
    choices: [
      { name: holderService[0].name, value: holderService[0].scrapeOutPath },
      { name: holderService[1].name, value: holderService[1].scrapeOutPath },
      { name: holderService[2].name, value: holderService[2].scrapeOutPath },
      { name: holderService[3].name, value: holderService[3].scrapeOutPath },
      { name: holderService[4].name, value: holderService[4].scrapeOutPath }
    ],
    when: async function (answers) {
      return answers.action === 'Analyse earlier data scraped'
    }
  }
]

async function saveScrape (input, filePath) {
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
  const startTime = new Date().toISOString()
  let filePath = './scraped-data/test/'
  let result
  if (answers.action === 'Build distribution') {
    makeDistData()
    return
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
  } else if (answers.scrapeService === 'all') {
    runAll(answers.scrapeMasterData)
    return
  } else if (answers.action === 'Scrape data from web') {
    let lastScrapedData
    if (answers.scrapeService === 'forbrugsforeningen') {
      filePath = './scraped-data/forb/'
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      result = await doForbrugScrape(browserHolder, lastScrapedData)
    } else if (answers.scrapeService === 'logbuy') {
      filePath = './scraped-data/logb/'
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      result = await doLogbuyScrape(browserHolder, lastScrapedData)
    } else if (answers.scrapeService === 'coop') {
      filePath = './scraped-data/coop/'
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      result = await doCoopScrape(browserHolder, lastScrapedData)
    } else if (answers.scrapeService === 'aeldresagen') {
      filePath = './scraped-data/aeld/'
      lastScrapedData = answers.scrapeMasterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
      result = await doAeldreScrape(browserHolder, lastScrapedData)
    }
  } else {
    throw new Error('No choices matched anything')
  }

  saveScrape(result, filePath)
  // Print to console both start and finish time
  console.log('Script ran from ' + startTime + ' to ' + new Date().toISOString())
}
// init()

async function initForb (masterData) {
  const filePath = './scraped-data/forb/'
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  const result = await doForbrugScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
}

async function initLogb (masterData) {
  const filePath = './scraped-data/logb/'
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  const result = await doLogbuyScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
}

async function initCoop (masterData) {
  const filePath = './scraped-data/coop/'
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  const result = await doCoopScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
}

async function initAeld (masterData) {
  const filePath = './scraped-data/aeld/'
  const lastScrapedData = masterData ? JSON.parse(await myFunc.lastFileContent(filePath)) : null
  const result = await doAeldreScrape(browserHolder, lastScrapedData)
  await saveScrape(result, filePath)
}

async function runAll (masterData = true) {
  console.log(new Date().toISOString() + ' Running all scrapes now')
  Promise.all(
    [
      initForb(masterData),
      initLogb(masterData),
      initCoop(masterData),
      initAeld(masterData)
    ]
  ).then(() => {
    makeDistData()
    console.log(new Date().toISOString() + ' Running all scrapes ended')
  })
}

// Decide how to run code
if (process.argv.length > 2 && process.argv[2].toLowerCase() === 'all') {
  runAll()
} else {
  run()
}

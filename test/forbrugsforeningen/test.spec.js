'use strict'
const forbrugScrape = require('../../modules/doForbrugScrape.js')
const myUtil = require('../../utils/my-utilities.js')
const { initPuppeteerPool } = require('../../modules/my-puppeteer.js')
const { holderService } = require('../../settings.js')
const startTime = new Date().toISOString()
const EventEmitter = require('events')
global.eventEmitter = new EventEmitter()
const holder = {
  jobsActive: 0,
  jobQueueDone: []
}

// Returns a generic-pool instance
const pool = initPuppeteerPool()

holder.savedDataFromScrape = {}
async function saveFromScrape(service = 'empty', data = {}) {
  // If object does not contain the key of content of service, make an array before pushing data
  if (!Object.prototype.hasOwnProperty.call(holder.savedDataFromScrape, service)) {
    holder.savedDataFromScrape[service] = []
  }
  holder.savedDataFromScrape[service].push(data)
  // As this function should get called during active scraps. Reset watchdog timer on call
  if (holder.poolWatching) { holder.activityTimer.refresh() }
}

async function saveToFile(input, filePath) {
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

async function prepareSaveToFile(inputData = { empty: [] }) {
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
  holder.activityTimerTimeout = true
  poolWatcher()
  setTimeout(() => {
    console.error('watchdogTimer hard terminating process')
    process.exit(1)
  }, 2 * 60 * 1000)
}, 58 * 60 * 1000) // 2+58 min is the longest run time allowed
// Unref makes node able to end process even if this timer has not fired
// without it this time will keep the program running
holder.watchdogTimer.unref()

async function poolWatcher() {
  // Don't allow multiple pool watcher to run
  if (holder.poolWatching) { return }
  holder.poolWatching = true
  console.log('Pool watcher started, watching now.')
  holder.activityTimer = setTimeout(() => {
    console.error('Timeout ended process. Amount of jobs not done:', holder.jobsActive)
    console.error('Registered finished jobs are:', holder.jobQueueDone)
    holder.activityTimerTimeout = true
  }, 60 * 1000)

  while ((pool.borrowed > 0 || pool.pending > 0) && !holder.activityTimerTimeout) {
    console.log(`Pool is still working. Active: ${pool.borrowed}, pending: ${pool.pending}`)
    await myUtil.delay(5000)
  }
  if (holder.activityTimerTimeout) {
    console.error('Watchdog timer timeout; forcing pool draining now.')
  } else {
    console.log('Puppeteer pool is not in use anymore. Draining pool now.')
    clearTimeout(holder.activityTimer)
  }
  pool.drain().then(() => pool.clear())
  await prepareSaveToFile(holder.savedDataFromScrape)
  // if (holder.makeDistOnDone) { makeDistData() }
  console.log('Script ran from ' + startTime + ' to ' + new Date().toISOString())
}

// Test whole doForbrugScrape

// forbrugScrape.doForbrugScrape(pool, '', saveFromScrape, 'forbrugsforeningen')
// holder.jobsActive++
// poolWatcher()
// await prepareSaveToFile(holder.savedDataFromScrape)

// Test scrapeElementPages
holder.firstQueueArray = [
  {
    "name": "Arp-Hansen hoteller",
    "localLink": "https://www.forbrugsforeningen.dk/medlem/arp-hansen-hoteller",
    "discount": "9%",
    // "err3": "Err03: No link to external site was found on local element page"
  },
  {
    "name": "Bonnie Dyrecenter",
    "localLink": "https://www.forbrugsforeningen.dk/medlem/bonnie-dyrecenter",
    "discount": "5%",
    // "err3": "Err03: No link to external site was found on local element page"
  },
  {
    "name": "Sinnerup",
    "localLink": "https://www.forbrugsforeningen.dk/medlem/sinnerup",
    "discount": "5%",
    // "err3": "Err03: No link to external site was found on local element page"
  }
]
for (let index = holder.firstQueueArray.length - 1; index >= 0; index--) {
  forbrugScrape.scrapeElementPages(holder.firstQueueArray.pop(), saveFromScrape, pool)
  holder.jobsActive++
}
poolWatcher()
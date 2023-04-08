'use strict'
const myPuppeteer = require('./my-puppeteer.js')
// Add standard JS es6 fetch to node
const fetch = require('node-fetch')
// Cheerio is a HTML interpreter
const cheerio = require('cheerio')

/**
 * Perform scape of data
 * @param {Object} PupPool Puppeteer pool
 * @param {Array<Object>} [masterData=null] Optional array containing objects with earlier results
 * @param {Function} returnDataToMainThread Callback function called on every successfully scrape
 * @param {string} saveDataKey Optional string returned as first argument in callback above
 */
async function doAeldreScrape (PupPool, masterData = null, returnDataToMainThread, saveDataKey = 'empty') {
  const holder = {
    firstQueueArray: [],
    firstQueueAmountDone: 0
  }
  holder.masterDataAmount = masterData ? masterData.length : undefined
  try {
    queueWatcher()
    PupPool.use(async (browser) => {
      const page = await myPuppeteer.setupPage(browser)
      // No login page here
      await page.goto('https://www.aeldresagen.dk/', { waitUntil: 'networkidle2' })
      // Click cookie popup if it is found
      await Promise.race([
        page.click('#declineButton'),
        page.waitForTimeout(5000)
      ])
      await page.waitForTimeout(500)
      // Go to search page and scrape the content
      console.log('Aeldresagen: Data scrape search page starting')
      await scrapeMainPage(page)
      console.log('Aeldresagen: Data scrape search page ending')
    }).catch(err => {
      console.log(err)
    })
  } catch (err) {
    console.log('--Error---')
    console.log(err)
    console.log('---------')
    process.exitCode = 1
  }

  async function queueWatcher () {
    async function delay (msSec) {
      return new Promise(resolve => {
        setTimeout(() => resolve('DelayTimeout'), msSec)
      })
    }
    // Fix: sometimes before a job is finished and before just before a new one is
    //  pending this while loop just went false. Looking at generated data fixes this.
    let timeout = 60 // Timeout in seconds
    while (timeout > 0 && holder.firstQueueArray.length === 0) {
      await delay(1000)
      timeout--
    }
    if (timeout < 1) {
      console.warn('Aeldresagen: Queue timeout happened. Something might have gone wrong. Watching queue now.')
    } else {
      console.log('Aeldresagen: Queue watcher started, watching now. Timeout left:', timeout)
    }

    while (holder.firstQueueArray.length > 0 || !holder.firstQueueGeneratingDone) {
      for (let index = holder.firstQueueArray.length - 1; index >= 0; index--) {
        scrapeElementPages(holder.firstQueueArray.pop())
        holder.firstQueueAmountDone++
      }
      if (holder.firstQueueGeneratingDone && holder.firstQueueAmount) {
        console.log(`Aeldresagen: External scrape queued ${holder.firstQueueAmountDone} jobs out of ${holder.firstQueueAmount}. ${Math.floor(holder.firstQueueAmountDone / holder.firstQueueAmount * 100)}% done.`)
      } else if (holder.masterDataAmount) {
        console.log(`Aeldresagen: External scrape queued ${holder.firstQueueAmountDone} jobs. Based on last scrape amount (${holder.masterDataAmount}) ${Math.floor(holder.firstQueueAmountDone / holder.masterDataAmount * 100)}% done.`)
      } else {
        console.log(`Aeldresagen: External scrape queued ${holder.firstQueueAmountDone} jobs.`)
      }
      await delay(10000)
    }
    if (holder.firstQueueAmountDone > 0) {
      console.log(`Aeldresagen: Queue of ${holder.firstQueueAmountDone} done. Ended process`)
    } else {
      console.warn('Aeldresagen: No queue was generated. Something went wrong')
      process.exitCode = 1
    }
    global.eventEmitter.emit('jobFinished', saveDataKey)
  }

  async function scrapeMainPage (page) {
    try {
      holder.lastScrapeMain = []
      // Go to page no 30 (cludopage=30) on search page to load pages from 1-30 in one go.
      // There are 30 discounts pr page and as of year 2020 page 18-22 is usually the last page.
      // Getting all the way up to page 30 should make sure this script can handel up to 900 discounts(at year 2020 discounts was 600)
      const pages = 60
      page.setDefaultTimeout(pages * 5000)
      await page.goto('https://www.aeldresagen.dk/tilbud-og-rabatter/tilbud/alle-tilbud-og-rabatter#?cludoquery=*&cludopage='+pages, { waitUntil: 'load' })
      console.log('Aeldresagen: Main page is now loaded. Starting scrape now.')
      // Scrape data from the search result page the pages keeps getting generated while visiting
      // and so more and more data will be scrapes without navigating to a new page
      // By comparing the length of list at each loop. At se length = no more data is coming
      do {
        await page.waitForTimeout(5000)
        holder.firstQueueAmount = holder.lastScrapeMainLength || 0
        holder.lastScrapeMain = await page.$$eval('ul.common-list__list > li', (elements, firstQueueAmount) => {
          return elements.map((element, index, elementArray) => {
            // Make empty object
            elementArray[index] = {}
            if (index >= firstQueueAmount) {
              try {
                // Get headline of discount
                elementArray[index].name = element.querySelector('h4').textContent.trim()
                // Mark the element in scope
                // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
                // Get link to mre info about discount
                elementArray[index].localLink = element.querySelector('a').href
                // Get sub info about discount/amount of discount
                elementArray[index].discount = element.querySelector('.m-offer__description.u-hidden--md-down').textContent.trim()
                // Replace dot with commas, remove trailing zero after commas
                elementArray[index].discount = elementArray[index].discount ? elementArray[index].discount.replace(/\./gi, ',').replace(/\.0|,0/gi, '') : null
              } catch (error) {
                elementArray[index].err1 = 'Err01: Scraping search result page: ' + error.message
              }
            }
            return elementArray[index]
          })
        }, holder.firstQueueAmount)
        // Remember the length of the last scrape on main page
        holder.lastScrapeMainLength = holder.lastScrapeMain.length
        // Remove elements that was already there in previous scrape
        holder.lastScrapeMain.splice(0, holder.firstQueueAmount)
        // Push new elements to job queue
        holder.firstQueueArray.push(...holder.lastScrapeMain)
      } while (holder.lastScrapeMainLength > holder.firstQueueAmount)
      // Remember the total amount of elements send to the job queue
      holder.firstQueueAmount += holder.lastScrapeMain.length
      // Delete unused elements
      delete holder.lastScrapeMain
      delete holder.lastScrapeMainLength
    } catch (error) {
      console.error('Aeldresagen: Scraping main page ended in error.', error)
    }
    try {
      await page.close()
    } catch (error) {
      // No need to handle error just don't stop the process
    }
    holder.firstQueueGeneratingDone = true
  }
  async function scrapeElementPages (dataPoint) {
    try {
      if (dataPoint.localLink) {
        if (masterData) {
          const index = masterData.findIndex(element => element.localLink === dataPoint.localLink)
          if (index > -1 && masterData[index].remoteLink) {
            dataPoint.remoteLink = masterData[index].remoteLink
            dataPoint.masterData = true
            return returnDataToMainThread(saveDataKey, dataPoint)
          }
        }
        const foundLink = await fetchLink(dataPoint.localLink)
        if (foundLink == null) {
          dataPoint.err3 = 'Err03: No link to external site was found on local element page'
          return returnDataToMainThread(saveDataKey, dataPoint)
        }
        dataPoint.remoteLink0 = foundLink
        PupPool.use(async (browser) => {
          try {
            const page = await myPuppeteer.setupPage(browser)
            await page.goto(foundLink, { waitUntil: 'domcontentloaded' })
            dataPoint.remoteLink = await page.evaluate('document.domain')
            await page.close()
          } catch (error) {
            dataPoint.err4 = 'Err04: Error inside pool: ' + error.message
          }
          returnDataToMainThread(saveDataKey, dataPoint)
        })
      } else {
        dataPoint.err1 = 'Err05: No link was found'
        returnDataToMainThread(saveDataKey, dataPoint)
      }
    } catch (error) {
      dataPoint.err2 = 'Err02: Search for remote link: ' + error.message
      returnDataToMainThread(saveDataKey, dataPoint)
    }
  }

  async function fetchLink (url) {
    let response
    // Try the fetching two times
    try {
      response = await fetch(url)
    } catch (error1) {
      console.error('\x1b[31mResponse error. Trying again\x1b[0m')
      console.log(error1)
      try {
        response = await fetch(url)
      } catch (error2) {
        console.error('\x1b[31mResponse error at second try.\x1b[0m')
        throw error2
      }
      console.info('\x1b[33mResponse ok at second try.\x1b[0m')
    }
    const body = await response.text()
    const $ = cheerio.load(body)
    // Select elements with href that don't start with "mailto"
    return $('.box-unfold__section a:not([href^="mailto"])').attr('href')
  }
}

exports.doAeldreScrape = doAeldreScrape

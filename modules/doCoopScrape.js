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
async function doCoopScrape (PupPool, masterData = null, returnDataToMainThread, saveDataKey = 'empty') {
  try {
    // const browser = await myPuppeteer.setupBrowser(browserHolder)
    PupPool.use(async (browser) => {
      const page = await myPuppeteer.setupPage(browser)
      // No login page here
      // ....
      // Go to search page and scrape the content
      console.log('Coop: Data scrape search page starting')
      const scrapeData = await scrapeMainPage(page)
      console.log('Coop: Data scrape search page ending')
      await page.close()
      return scrapeData
    }).then(async (scrapeData) => {
      // Loop scraped data and find the link the the external site
      scrapeElementPages(PupPool, scrapeData, masterData)
      console.log('Coop: Data scrape external sites done')
    }).catch(err => {
      console.log(err)
    })
  } catch (err) {
    console.log('--Error---')
    console.log(err)
    console.log('---------')
    process.exitCode = 1
  }

  async function scrapeMainPage (page) {
    try {
      await page.goto('https://partnerfordele.coop.dk/?tag=alle', { waitUntil: 'networkidle2' })
      // Scrape data from the search result page
      return page.$$eval('.partner:not(.hidden)', elements => {
        return elements.map((element, index, elementArray) => {
          elementArray[index] = {}
          try {
            // Get headline of discount
            elementArray[index].name = element.querySelector('.partner-name').textContent.trim()
            // Mark the element in scope
            // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
            // Get link to mre info about discount
            elementArray[index].localLink = element.querySelector('.partner-name a').href
            // Get sub info about discount/amount of discount
            elementArray[index].discount = element.querySelector('.bubble-wrapper').textContent.trim()
            // Replace dot with commas, remove trailing zero after commas
            elementArray[index].discount = elementArray[index].discount ? elementArray[index].discount.replace(/\./gi, ',').replace(/\.0|,0/gi, '') : null
          } catch (error) {
            elementArray[index].err1 = 'Err01: Scraping search result page: ' + error.message
          }
          return elementArray[index]
        })
      })
    } catch (error) {
      console.error('Coop: Scraping main page ended in error.', error)
      await page.screenshot({ path: './logs/coop/scrapeMainFault.png' })
    }
  }

  async function scrapeElementPages (pool, scrapeData, masterData) {
    // page.setDefaultTimeout(10000)
    const dataLength = scrapeData.length
    let i1 = 0
    let i2 = 0
    for (const dataPoint of scrapeData) {
      i1++
      i2++
      if (i1 > 19) {
        console.log('Coop: External scrape at #' + i2 + ' out of: ' + dataLength + ' [' + Math.floor(i2 / dataLength * 100) + ' %]')
        i1 = 0
      }
      try {
        if (dataPoint.localLink) {
          if (masterData) {
            const index = masterData.findIndex(element => element.localLink === dataPoint.localLink)
            if (index > -1 && masterData[index].remoteLink) {
              dataPoint.remoteLink = masterData[index].remoteLink
              dataPoint.masterData = true
              returnDataToMainThread(saveDataKey, dataPoint)
              continue
            }
          }
          const foundLink = await fetchLink(dataPoint.localLink)
          if (foundLink == null) {
            dataPoint.err3 = 'Err03: No link to external site was found on local element page'
            returnDataToMainThread(saveDataKey, dataPoint)
            continue
          }
          dataPoint.remoteLink0 = foundLink
          pool.use(async (browser) => {
            try {
              const page = await myPuppeteer.setupPage(browser)
              await page.goto(foundLink, { waitUntil: 'domcontentloaded' })
              dataPoint.remoteLink = await page.evaluate('document.domain')
            } catch (error) {
              dataPoint.err4 = 'Err04: Error inside pool: ' + error.message
            }
            returnDataToMainThread(saveDataKey, dataPoint)
          })
        } else {
          dataPoint.err5 = 'Err05: No link was found'
          returnDataToMainThread(saveDataKey, dataPoint)
        }
      } catch (error) {
        dataPoint.err2 = 'Err02: Search for remote link: ' + error.message
        returnDataToMainThread(saveDataKey, dataPoint)
      }
    }
    global.eventEmitter.emit('jobFinished', saveDataKey)
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
    return $('section a').attr('href')
  }
}

exports.doCoopScrape = doCoopScrape

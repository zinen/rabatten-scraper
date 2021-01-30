'use strict'
const myPuppeteer = require('./myPuppeteer.js')
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
async function doForbrugScrape (PupPool, masterData = null, returnDataToMainThread, saveDataKey = 'empty') {
  try {
    // const browser = await myPuppeteer.setupBrowser(browserHolder)
    PupPool.use(async (browser) => {
      const page = await myPuppeteer.setupPage(browser)
      console.log('Forbrugsforeningen: Data scrape search page starting')
      // No login page here
      // ....
      // Go to the page with search result of all web shops
      const scrapeData = await scrapeMainPage(page)
      console.log('Forbrugsforeningen: Data scrape search page ending')
      await page.close()
      return scrapeData
    }).then(async (scrapeData) => {
      // Loop scraped data and find the link the the external site
      scrapeElementPages(PupPool, scrapeData, masterData)
      // console.log('Forbrugsforeningen: Data scrape external sites done')
    }).catch(err => {
      console.log(err)
    })

    // Debug: Insert test data from a predefined object
    // let scrapeData = testDataConst()
    // Loop scraped data and find the link the the external site
  } catch (err) {
    console.log('--Error---')
    console.log(err)
    console.log('---------')
    process.exitCode = 1
  }

  // Debug: force test specific sites
  //   function testDataConst () {// eslint-disable-line
  //     const testData = [
  //       {
  //         name: '0: Err02: Search for remote link: TypeError',
  //         localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002256936'
  //       },
  //       {
  //         name: '1: Err02: Search for remote link: TimeoutError',
  //         localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002104949'
  //       },
  //       {
  //         name: '2: Err02: Search for remote link: Error',
  //         localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002092983'
  //       },
  //       {
  //         name: '3: Err02: Search for remote link: TypeError',
  //         localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002255526'
  //       },
  //       {
  //         name: 'test',
  //         localLink: 'about:blank'
  //       }
  //     ]
  //     return [testData[0], testData[3]]
  //   }

  async function scrapeMainPage (page) {
    await page.goto('https://www.forbrugsforeningen.dk/search?q&w=True&s=False', { waitUntil: 'networkidle2' })
    // Wait for first data to be retrieved
    await page.waitForSelector('.grouped-list__group-content:nth-of-type(1)')
    await page.waitForTimeout(1000)
    // Fix: Press down and wait, the page might reload for some weird reason
    await page.keyboard.press('PageDown')
    await Promise.race([
      page.waitForNavigation(),
      page.waitForTimeout(5000)
    ])
    // Move down the page to reveal the search results
    while (!(await page.$('#search-results > div.search-result-page__footer[style*="display: block"]'))) {
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(50)
    }
    // Scrape data from the search result page
    return page.evaluate(() => {
      const sectionList = []
      const sectionElms = document.querySelectorAll('section.grouped-list__group-content')
      sectionElms.forEach((sectionElements) => {
        const holderJson = {}
        try {
          holderJson.name = sectionElements.querySelector('span.grouped-list__shop-name').textContent.trim()
          // Mark the element in scope
          // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
          holderJson.localLink = sectionElements.querySelector('a').href
          holderJson.discount = sectionElements.querySelector('.grouped-list__col--2 > span').textContent.trim()
          // Replace dot with commas, remove trailing zero after commas
          holderJson.discount = holderJson.discount ? holderJson.discount.replace(/\./gi, ',').replace(/\.0|,0/gi, '') : null
        } catch (error) {
          holderJson.err1 = 'Err01: Scraping search result page: ' + error.name
        }
        sectionList.push(holderJson)
      })
      return sectionList
    })
  }

  async function scrapeElementPages (pool, scrapeData, masterData) {
    // page.setDefaultTimeout(10000)
    const dataLength = scrapeData.length
    let i1 = 1000
    let i2 = 0
    for (const dataPoint of scrapeData) {
      i1++
      i2++
      if (i1 > 19) {
        console.log('Forbrugsforeningen: External scrape at #' + i2 + ' out of: ' + dataLength + ' [' + Math.floor(i2 / dataLength * 100) + ' %]')
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
              await page.close()
            } catch (error) {
              dataPoint.err4 = 'Err04: Error inside pool: ' + error.name
            }
            returnDataToMainThread(saveDataKey, dataPoint)
          })
        } else {
          dataPoint.err5 = 'Err05: No link was found'
          returnDataToMainThread(saveDataKey, dataPoint)
        }
      } catch (error) {
        dataPoint.err2 = 'Err02: Search for remote link: ' + error.name
        returnDataToMainThread(saveDataKey, dataPoint)
      }
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
    return $('article > div.col.first > p > a').attr('href')
  }
}

exports.doForbrugScrape = doForbrugScrape

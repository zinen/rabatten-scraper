'use strict'
const myPuppeteer = require('./my_puppeteer.js')
// Add standard JS es6 fetch to node
const fetch = require('node-fetch')
// Chherio is a HTML interpretator
const cheerio = require('cheerio')

/**
 * Perform scape of data
 * @param {Object} browserHolder Puppeteer browser object
 * @param {Array<Object>} [masterData=null] Option array containing objects with erlier results
 * @returns {Array<Object>} Array containing objects with results
 */
async function doForbrugScrape (browserHolder, masterData = null) {
  try {
    const browser = await myPuppeteer.setupBrowser(browserHolder)
    const page = await myPuppeteer.setupPage(browser)
    // No login page here
    // ....
    // Go to the page with search result of all webshops
    console.log('Forbrugsforeningen: Data scrape search page starting')
    let scrapeData = await scrapeMainPage(page)
    console.log('Forbrugsforeningen: Data scrape search page ending')
    // Debug: Insert test data from a predefined object
    // let scrapeData = testDataConst()
    // Loop scraped data and find the link the the external site
    scrapeData = await scrapeElementPages(page, scrapeData, masterData)
    console.log('Forbrugsforeningen: Data scrape external sites done')
    try {
      await browser.close()
    } catch (error) {
      console.log(error.message)
    }
    return scrapeData
  } catch (err) {
    console.log('--Error---')
    console.log(err)
    console.log('---------')
    process.exitCode = 1
  }
  function testDataConst () {// eslint-disable-line
    const testData = [
      {
        name: '0: Err02: Search for remote link: TypeError',
        localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002256936'
      },
      {
        name: '1: Err02: Search for remote link: TimeoutError',
        localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002104949'
      },
      {
        name: '2: Err02: Search for remote link: Error',
        localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002092983'
      },
      {
        name: '3: Err02: Search for remote link: TypeError',
        localLink: 'https://www.forbrugsforeningen.dk/businesssearch//1002255526'
      },
      {
        name: 'test',
        localLink: 'about:blank'
      }
    ]
    return [testData[0], testData[3]]
  }

  async function scrapeMainPage (page) {
    await page.goto('https://www.forbrugsforeningen.dk/search?q&w=True&s=False', { waitUntil: 'networkidle2' })
    // Wait for first data to be retrived
    await page.waitFor('.grouped-list__group-content:nth-of-type(2)')
    await page.waitFor(1000)
    // Fix: Press down and wait, the page might reload for some weird reson
    await page.keyboard.press('PageDown')
    await Promise.race([
      page.waitForNavigation(),
      page.waitFor(5000)
    ])
    // Move down the page to reveal the search results
    while (!(await page.$('#search-results > div.search-result-page__footer[style*="display: block"]'))) {
      await page.keyboard.press('PageDown')
      await page.waitFor(50)
    }
    // Scrape data from the search result page
    const scrapeData = await page.evaluate(() => {
      const sectionList = []
      const sectionElms = document.querySelectorAll('section.grouped-list__group-content')
      sectionElms.forEach((sectionElements) => {
        const holderJson = {}
        try {
          holderJson.name = sectionElements.querySelector('span.grouped-list__shop-name').innerText
          // Mark the element in scope
          // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
          holderJson.localLink = sectionElements.querySelector('a').href
          holderJson.discount = sectionElements.querySelector('.grouped-list__col--2 > span').innerText
          // Replace dot with commas, remove trailing zero after commas
          holderJson.discount = holderJson.discount ? holderJson.discount.replace(/\./gi, ',').replace(/\.0|,0/gi, '') : null
        } catch (error) {
          holderJson.err1 = 'Err01: Scraping search result page: ' + error.name
        }
        sectionList.push(holderJson)
      })
      return sectionList
    })
    return scrapeData
  }

  async function scrapeElementPages (page, scrapeData, masterData) {
    page.setDefaultTimeout(10000)
    const dataLenght = scrapeData.length
    let i1 = 1000
    let i2 = 0
    for await (const dataPoint of scrapeData) {
      i1++
      i2++
      if (i1 > 19) {
        console.log('Forbrugsforeningen: External scrape at #' + i2 + ' out of: ' + dataLenght + ' [' + Math.floor(i2 / dataLenght * 100) + ' %]')
        i1 = 0
      }
      try {
        if (dataPoint.localLink) {
          if (masterData) {
            const index = masterData.findIndex(element => element.localLink === dataPoint.localLink)
            if (index > -1 && masterData[index].remoteLink) {
              dataPoint.remoteLink = masterData[index].remoteLink
              dataPoint.masterData = true
              continue
            }
          }
          const foundLink = await fetchForbrugLink(dataPoint.localLink)
          if (foundLink == null) {
            dataPoint.err3 = 'No link to external site was found on local element page'
            continue
          }
          dataPoint.remoteLink0 = foundLink
          try {
            await page.goto(foundLink, { waitUntil: 'networkidle2' })
          } catch (error) {
            // A few pages requests images in a forever loop, this is a fix for that
            await page.goto(foundLink, { waitUntil: 'domcontentloaded' })
          }
          dataPoint.remoteLink = page.url()
        } else {
          dataPoint.err1 = 'No link was found'
        }
      } catch (error) {
        dataPoint.err2 = 'Err02: Search for remote link: ' + error.name
      }
    }
    return scrapeData
  }

  async function fetchForbrugLink (url) {
    let resonse
    // Try the fetching two times
    try {
      resonse = await fetch(url)
    } catch (error1) {
      console.error('\x1b[31mResponse error. Trying again\x1b[0m')
      console.log(error1)
      try {
        resonse = await fetch(url)
      } catch (error2) {
        console.error('\x1b[31mResponse error at second try.\x1b[0m')
        throw error2
      }
      console.info('\x1b[33mResponse ok at second try.\x1b[0m')
    }
    const body = await resonse.text()
    const $ = cheerio.load(body)
    return $('article > div.col.first > p > a').attr('href')
  }
}

exports.doForbrugScrape = doForbrugScrape

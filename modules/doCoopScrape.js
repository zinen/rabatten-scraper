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
async function doCoopScrape (browserHolder, masterData = null) {
  try {
    const browser = await myPuppeteer.setupBrowser(browserHolder)
    const page = await myPuppeteer.setupPage(browser)
    // No login page here
    // ....
    // Go to search page and scrape the content
    console.log('Coop: Data scrape search page starting')
    let scrapeData = await scrapeMainPage(page)
    console.log('Coop: Data scrape search page ending')
    // Loop scraped data and find the link the the external site
    scrapeData = await scrapeElementPages(page, scrapeData, masterData)
    console.log('Coop: Data scrape external sites done')
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
  async function scrapeMainPage (page) {
    await page.goto('https://partnerfordele.coop.dk/?tag=alle', { waitUntil: 'networkidle2' })
    // Scrape data from the search result page
    const scrapeData = await page.evaluate(() => {
      const sectionList = []
      const sectionElms = document.querySelectorAll('.partner:not(.hidden)')
      sectionElms.forEach((sectionElements) => {
        const holderJson = {}
        try {
          holderJson.name = sectionElements.querySelector('.partner-name').innerText
          // Mark the element in scope
          // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
          holderJson.localLink = sectionElements.querySelector('.partner-name a').href
          holderJson.discount = sectionElements.querySelector('.bubble-wrapper').innerText
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
    let i1 = 0
    let i2 = 0
    for await (const dataPoint of scrapeData) {
      i1++
      i2++
      if (i1 > 19) {
        console.log('Coop: External scrape at #' + i2 + ' out of: ' + dataLenght + ' [' + Math.floor(i2 / dataLenght * 100) + ' %]')
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
          const foundLink = await fetchLink(dataPoint.localLink)
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
          dataPoint.remoteLink = await page.evaluate('document.domain')
        } else {
          dataPoint.err1 = 'No link was found'
        }
      } catch (error) {
        dataPoint.err2 = 'Err02: Search for remote link: ' + error.name
      }
    }
    return scrapeData
  }

  async function fetchLink (url) {
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
    return $('.link a').attr('href')
  }
}

exports.doCoopScrape = doCoopScrape

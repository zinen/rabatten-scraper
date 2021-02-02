'use strict'
const myPuppeteer = require('./my_puppeteer.js')
// Add standard JS es6 fetch to node
const fetch = require('node-fetch')
// Cherio is a HTML interpreter
const cheerio = require('cheerio')

/**
 * Perform scape of data
 * @param {Object} browserHolder Puppeteer browser object
 * @param {Array<Object>} [masterData=null] Option array containing objects with earlier results
 * @returns {Array<Object>} Array containing objects with results
 */
async function doAeldreScrape (browserHolder, masterData = null) {
  try {
    const browser = await myPuppeteer.setupBrowser(browserHolder)
    const page = await myPuppeteer.setupPage(browser)
    // No login page here
    // ....
    // Go to search page and scrape the content
    console.log('Aeldresagen: Data scrape search page starting')
    let scrapeData = await scrapeMainPage(page)
    console.log('Aeldresagen: Data scrape search page ending')
    // Loop scraped data and find the link the the external site
    scrapeData = await scrapeElementPages(page, scrapeData, masterData)
    console.log('Aeldresagen: Data scrape external sites done')
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
    page.setDefaultTimeout(240 * 1000)
    // Go to last page no 1000 on search page to load pages from 1-1000 in one go
    await page.goto('https://www.aeldresagen.dk/tilbud-og-rabatter/tilbud/alle-tilbud-og-rabatter#?cludoquery=*&cludosort=date%3Ddesc&cludopage=1000', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(220 * 1000)
    // Scrape data from the search result page
    const scrapeData = await page.evaluate(() => {
      const sectionList = []
      const sectionElms = document.querySelectorAll('ul.common-list__list > li')
      sectionElms.forEach((sectionElements) => {
        const holderJson = {}
        try {
          holderJson.name = sectionElements.querySelector('h2 a').textContent
          // Mark the element in scope
          // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
          holderJson.localLink = sectionElements.querySelector('a').href
          holderJson.discount = sectionElements.querySelector('.common-list__item__info__value').innerText
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
    const dataLength = scrapeData.length
    let i1 = 0
    let i2 = 0
    for await (const dataPoint of scrapeData) {
      i1++
      i2++
      if (i1 > 19) {
        console.log('Aeldresagen: External scrape at #' + i2 + ' out of: ' + dataLength + ' [' + Math.floor(i2 / dataLength * 100) + ' %]')
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
    // Select elements with href don't start with "mailto"
    return $('.box-unfold__section a:not([href^="mailto"])').attr('href')
  }
}

exports.doAeldreScrape = doAeldreScrape

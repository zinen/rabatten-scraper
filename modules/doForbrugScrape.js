'use strict'
const myPuppeteer = require('./my-puppeteer.js')

const holder = {
  firstQueueArray: [],
  firstQueueAmountDone: 0
}

/**
 * Perform scape of data
 * @param {Object} PupPool Puppeteer pool
 * @param {Array<Object>} [masterData=null] Optional array containing objects with earlier results
 * @param {Function} returnDataToMainThread Callback function called on every successfully scrape
 * @param {string} saveDataKey Optional string returned as first argument in callback above
 */
async function doForbrugScrape(PupPool, masterData = null, returnDataToMainThread, saveDataKey = 'empty') {
  holder.masterData = masterData
  holder.masterDataAmount = masterData ? masterData.length : undefined
  holder.pool = PupPool
  holder.saveDataKey = saveDataKey
  holder.returnDataToMainThread = returnDataToMainThread
  try {
    queueWatcher()
    holder.pool.use(async (browser) => {
      const page = await myPuppeteer.setupPage(browser)
      // No login page here
      // ....
      // Go to the page with search result of all web shops
      console.log('Forbrugsforeningen: Data scrape search page starting')
      await scrapeMainPage(page)
      console.log('Forbrugsforeningen: Data scrape search page ending')
    }).catch(err => {
      console.log(err)
    })
  } catch (err) {
    console.log('--Error---')
    console.log(err)
    console.log('---------')
    process.exitCode = 1
  }

  async function queueWatcher() {
    async function delay(msSec) {
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
      console.warn('Forbrugsforeningen: Queue timeout happened. Something might have gone wrong. Watching queue now.')
    } else {
      console.log('Forbrugsforeningen: Queue watcher started, watching now. Timeout left:', timeout)
    }

    while (holder.firstQueueArray.length > 0 || !holder.firstQueueGeneratingDone) {
      for (let index = holder.firstQueueArray.length - 1; index >= 0; index--) {
        scrapeElementPages(holder.firstQueueArray.pop())
        holder.firstQueueAmountDone++
      }
      if (holder.firstQueueGeneratingDone && holder.firstQueueAmount) {
        console.log(`Forbrugsforeningen: External scrape queued ${holder.firstQueueAmountDone} jobs out of ${holder.firstQueueAmount}. ${Math.floor(holder.firstQueueAmountDone / holder.firstQueueAmount * 100)}% done.`)
      } else if (holder.masterDataAmount) {
        console.log(`Forbrugsforeningen: External scrape queued ${holder.firstQueueAmountDone} jobs. Based on last scrape amount (${holder.masterDataAmount}) ${Math.floor(holder.firstQueueAmountDone / holder.masterDataAmount * 100)}% done.`)
      } else {
        console.log(`Forbrugsforeningen: External scrape queued ${holder.firstQueueAmountDone} jobs.`)
      }
      await delay(10000)
    }
    if (holder.firstQueueAmountDone > 0) {
      console.log(`Forbrugsforeningen: Queue of ${holder.firstQueueAmountDone} done. Ended process`)
    } else {
      console.warn('Forbrugsforeningen: No queue was generated. Something went wrong')
      process.exitCode = 1
    }
    global.eventEmitter.emit('jobFinished', holder.saveDataKey)
  }
}

async function scrapeMainPage(page) {
  try {
    holder.lastScrapeMain = []
    // At January 2023 the last "cludopage" was 162. Settings it a bit higher to allow growth
    const pages = 180
    // Allowing 2000 ms load time for each page
    page.setDefaultTimeout(pages * 2000)
    await page.goto(`https://www.forbrugsforeningen.dk/medlem/Soegeresultat#?cludoquery=*&cludopage=${pages}&cludoinputtype=standard`, { waitUntil: 'networkidle2' })
    // Wait for first data to be retrieved
    await page.waitForSelector('#search-results > div> ul > li.cludo-search-results-item')
    await page.waitForTimeout(1000)
    // Fix: Press down and wait, the page might reload for some weird reason
    await page.keyboard.press('PageDown')
    await Promise.race([
      page.waitForNavigation(),
      page.waitForTimeout(5000)
    ])
    // Scrape data from the search result page the page keeps getting more data when scrolling down
    // at the end a footer is loaded. This means no more discounts to scrape
    do {
      // Move down the page to reveal the search results
      await page.keyboard.press('PageDown')
      await page.keyboard.press('PageDown')
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(4000)
      await page.keyboard.press('PageDown')
      await page.keyboard.press('PageDown')
      await page.keyboard.press('PageDown')
      await page.waitForTimeout(4000)
      holder.firstQueueAmount = holder.lastScrapeMainLength || 0
      holder.lastScrapeMain = await page.$$eval('#search-results > div> ul > li.cludo-search-results-item', (elements, firstQueueAmount) => {
        return elements.map((element, index, elementArray) => {
          // Make empty object
          elementArray[index] = {}
          if (index >= firstQueueAmount) {
            try {
              // Get headline of discount
              elementArray[index].name = element.querySelector('h2').textContent.trim()
              // Mark the element in scope
              // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
              // Get link to mre info about discount
              elementArray[index].localLink = element.querySelector('a').href
              // Get sub info about discount/amount of discount
              elementArray[index].discount = element.querySelector('.bonus').textContent.trim()
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
    console.error('Forbrugsforeningen: Scraping main page ended in error.', error)
  }
  try {
    await page.close()
  } catch (error) {
    // No need to handle error just don't stop the process
  }
  holder.firstQueueGeneratingDone = true
}
exports.scrapeMainPage = scrapeMainPage

async function scrapeElementPages(dataPoint, testReturnDataToMainThread, testPupPool) {
  if (!holder.returnDataToMainThread) holder.returnDataToMainThread = testReturnDataToMainThread
  if (!holder.pool) holder.pool = testPupPool
  try {
    if (dataPoint.localLink) {
      if (holder.masterData) {
        const index = holder.masterData.findIndex(element => element.localLink === dataPoint.localLink)
        if (index > -1 && holder.masterData[index].remoteLink) {
          dataPoint.remoteLink = holder.masterData[index].remoteLink
          dataPoint.masterData = true
          return holder.returnDataToMainThread(holder.saveDataKey, dataPoint)
        }
      }
      holder.pool.use(async (browser) => {
        try {
          const page = await myPuppeteer.setupPage(browser)
          await page.goto(dataPoint.localLink, { waitUntil: 'networkidle0' })
          // See if either priority 1 or 2 button is found. Priority 1 button usually leads directly to the remote page
          // wheres the priority 2 button opens new url with button like  Priority 1 button
          await Promise.race([
            page.waitForSelector('#partner-widget a:not([href^="mailto"],[href^="tel"])'),
            page.waitForSelector('#search-results li h2')
          ])
          const linkPriority1 = await page.$('#partner-widget a:not([href^="mailto"],[href^="tel"])')
          let linkPriority2 = await page.$('#search-results li h2')
          if (linkPriority1) {
            try {
              const foundLink = await page.$eval('#partner-widget a:not([href^="mailto"],[href^="tel"])', element => element.href)
              dataPoint.remoteLink0 = foundLink
              await page.goto(foundLink, { waitUntil: 'domcontentloaded' })
              dataPoint.remoteLink = await page.evaluate('document.domain')
              if ((dataPoint.remoteLink).contains('tradedoubler.com')) {
                await page.waitForNavigation()
                dataPoint.remoteLink = await evalRedirects(await page.evaluate('document.domain'), page)
              }
              return holder.returnDataToMainThread(holder.saveDataKey, dataPoint)
            } catch (error) {
              if (linkPriority2 != null) {
                dataPoint.err0 = 'Priority 1 link following failed. Trying link 2'
                // Go back to the page with links to external site
                await page.goto(dataPoint.localLink, { waitUntil: 'networkidle2' })
                dataPoint.remoteLinkPri1 = dataPoint.remoteLink0
                // Must re-define linkPriority2 do to page navigation
                linkPriority2 = await page.$('#search-results li h2')
              } else {
                dataPoint.err0 = 'Priority 1 link following failed. No link 2 found'
                return holder.returnDataToMainThread(holder.saveDataKey, dataPoint)
              }
            }
          }
          if (linkPriority2) {
            await Promise.all([
              linkPriority2.click(),
              page.waitForNavigation({
                waitUntil: 'networkidle0',
              })
            ]);
            await Promise.race([
              page.waitForTimeout(500),
              page.waitForSelector('#partner-widget a:not([href^="mailto"],[href^="tel"])')
            ]);
            const foundLink = await page.$eval('#partner-widget a:not([href^="mailto"],[href^="tel"])', element => element.href)
            dataPoint.remoteLink0 = foundLink
            try {
              await page.goto(foundLink, { waitUntil: 'networkidle2' })
            } catch (error) {
              // A few pages requests images in a forever loop, this is a fix for that
              await page.goto(foundLink, { waitUntil: 'domcontentloaded' })
            }
            dataPoint.remoteLink = await evalRedirects(await page.evaluate('document.domain'), page)
          } else {
            dataPoint.err3 = 'Err03: No link to external site was found on local element page'
          }
        } catch (error) {
          dataPoint.err4 = 'Err04: Error inside pool: ' + error.message
        }
        holder.returnDataToMainThread(holder.saveDataKey, dataPoint)
      })
    } else {
      dataPoint.err1 = 'Err05: No link was found'
      holder.returnDataToMainThread(holder.saveDataKey, dataPoint)
    }
  } catch (error) {
    dataPoint.err2 = 'Err02: Search for remote link: ' + error.message
    holder.returnDataToMainThread(holder.saveDataKey, dataPoint)
  }
}
exports.scrapeElementPages = scrapeElementPages

async function evalRedirects(URL, page) {
  const reDirectSites = [
    'tradedoubler.com/',
    'doubleclick.net/',
    'bit.ly/',
    'salestring.com/',
    'chrome-error://',
    'www.google.com'
  ]
  if (reDirectSites.some(resource => URL.indexOf(resource) !== -1)) {
    try {
      await page.waitForNavigation()
    } catch (error) {
      if (reDirectSites.some(resource => page.url().indexOf(resource) !== -1)) {
        console.log('Waited for at redirects, but it didn\'t happen at: ' + URL)
        throw new Error('Ended at redirection site')
      }
    }
    return page.evaluate('document.domain')
  } else {
    return URL
  }
}
exports.evalRedirects = evalRedirects

exports.doForbrugScrape = doForbrugScrape

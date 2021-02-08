'use strict'
const myPuppeteer = require('./my-puppeteer.js')

/**
 * Perform scape of data
 * @param {Object} PupPool Puppeteer pool
 * @param {Array<Object>} [masterData=null] Optional array containing objects with earlier results
 * @param {Function} returnDataToMainThread Callback function called on every successfully scrape
 * @param {string} saveDataKey Optional string returned as first argument in callback above
 */
async function doLogbuyScrape (PupPool, masterData = null, returnDataToMainThread, saveDataKey = 'empty') {
  const holder = {
    firstQueueArray: [],
    firstQueueAmountDone: 0
  }
  if (masterData) { holder.masterDataAmount = masterData.length }
  try {
    queueWatcher()
    // const browser = await myPuppeteer.setupBrowser(browserHolder)
    PupPool.use(async (browser) => {
      const page = await myPuppeteer.setupPage(browser)
      // Go to login page and login
      console.log('Logbuy: Performing login')
      await goLogin(page)
      // Go to search page and scrape the content
      console.log('Logbuy: Data scrape search page starting')
      await scrapeMainPage(page)
      console.log('Logbuy: Data scrape search page ending')
    }).catch(err => {
      holder.firstQueueGeneratingDone = true
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
      console.warn('Logbuy: Queue timeout happened. Something might have gone wrong. Watching queue now.')
    } else {
      console.log('Logbuy: Queue watcher started, watching now.Timeout left:', timeout)
    }

    while (holder.firstQueueArray.length > 0 || !holder.firstQueueGeneratingDone) {
      for (let index = holder.firstQueueArray.length - 1; index >= 0; index--) {
        scrapeElementPages(holder.firstQueueArray.pop())
        holder.firstQueueAmountDone++
      }
      if (holder.firstQueueGeneratingDone && holder.firstQueueAmount) {
        console.log(`Logbuy: External scrape queued ${holder.firstQueueAmountDone} jobs out of ${holder.firstQueueAmount}. ${Math.floor(holder.firstQueueAmountDone / holder.firstQueueAmount * 100)}% done.`)
      } else if (holder.masterDataAmount) {
        console.log(`Logbuy: External scrape queued ${holder.firstQueueAmountDone} jobs. Based on last scrape amount (${holder.masterDataAmount}) ${Math.floor(holder.firstQueueAmountDone / holder.masterDataAmount * 100)}% done.`)
      } else {
        console.log(`Logbuy: External scrape queued ${holder.firstQueueAmountDone} jobs.`)
      }
      await delay(10000)
    }
    console.log(`Logbuy: Queue of ${holder.firstQueueAmountDone} done. Ended process`)
    global.eventEmitter.emit('jobFinished', saveDataKey)
  }

  async function goLogin (page) {
    await page.goto('https://www.mylogbuy.com/WebPages/Login/loginFrame.aspx?ReturnUrl=', { waitUntil: 'networkidle2' })
    await page.type('#ctl00_ctl00_Content_content_TextBox_Email', process.env.LOGBUY_USER)
    await page.type('#ctl00_ctl00_Content_content_TextBox_Password', process.env.LOGBUY_PASS)
    await Promise.all([
      page.waitForNavigation(),
      page.click('#ctl00_ctl00_Content_content_LinkButton_Login')
    ])
    // Store cookies as this site requires login
    holder.logbuyCookies = await page.cookies('https://www.mylogbuy.com')
  }

  async function scrapeMainPage (page) {
    try {
      await page.goto('https://www.mylogbuy.com/WebPages/Search/List.aspx?q=', { waitUntil: 'networkidle2' })
      // Scrape result page. The page has a page switcher at the bottom.
      // clicking 'next' until the next button is no longer there means no more discounts to be found
      do {
        await page.waitForSelector('div.searchwrapper:not(.add)')
        // Class .add is used at adds placed within search results
        // Class .specialoffer is used for short limited discount and is not scraped
        holder.firstQueueArray.push(...await page.$$eval('div.searchwrapper:not(.add) a > :not(.specialoffer)', elements => {
          return elements.map((element, index, elementArray) => {
          // Make empty object
            elementArray[index] = {}
            try {
            // Get headline of discount
              elementArray[index].name = element.querySelector('.name').textContent.trim()
              // Mark the element in scope
              // sectionElements.querySelector('span.grouped-list__shop-name').style.border = 'thick solid red'
              // Get link to mre info about discount
              elementArray[index].localLink = element.parentElement.href
              // Get sub info about discount/amount of discount
              elementArray[index].discount = element.querySelector('.ribbon-wrapper').textContent.trim()
              // Replace dot with commas, remove trailing zero after commas
              elementArray[index].discount = elementArray[index].discount ? elementArray[index].discount.replace(/\./gi, ',').replace(/\.0|,0/gi, '') : null
            } catch (error) {
              elementArray[index].err1 = 'Err01: Scraping search result page: ' + error.message
            }
            return elementArray[index]
          })
        }))
      } while (
      // Switch to next page
        await page.$$eval('.pagingwrapper a.pageLink', elements => {
          if (elements[elements.length - 1].innerText === 'Næste >') {
            elements[elements.length - 1].click()
            return true
          } else {
            return false
          }
        }))
    } catch (error) {
      console.error('Forbrugsforeningen: Scraping main page ended in error.', error)
    }
    try {
      // Try to close the page any handing page
      await page.close()
    } catch (error) {
      // No need to handle error just don't stop the process
    }
    holder.firstQueueGeneratingDone = true
  }

  // async function scrapeMainPage (page) {
  //   return [
  //     {
  //       name: '\n                        \n                            Winefamly\n                        \n                    ',
  //       localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=19268&SupplierClickArea=SearchList&ViewType=Normal',
  //       discount: '10 %'
  //     }
  //   ]
  // }

  // Debug: force test specific sites
  //   function testDataConst () {// eslint-disable-line
  //     const testData = [
  //       {
  //         name: '0: Har både direkte link og sekundær',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=19244&AddressId=162104&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '1: Har kun sekundær link(det i en iframe)',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=2233&AddressId=161146&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '2: Har både direkte link og sekundær, men det direkte link virker ikke - nu virker det igen',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=18922&AddressId=161618&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '3: Intet hjemmeside link',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=493&AddressId=160147&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '4: Ingen net forbindelse til siden',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=18403&AddressId=160471&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '5: Sekundær link knap er lille',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=19038&AddressId=161777&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '6: Timeout fejl, scrape den forsøgte sides URL',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=17695&AddressId=159707&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '7: Accepter ikke tradedoubler.com links, afvent redirect',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=3810&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '8: Siden henter ikke færdig, scrape fejler derfor',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=18922&AddressId=161618&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '9: Siden giver timeout flere gange i træk',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=18730&AddressId=161417&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '10: Siden giver ingen URL fra sig',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=19019&AddressId=161746&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: '11: Endte på chromewebdata',
  //         localLink: 'https://www.mylogbuy.com/WebPages/ShowDeal/default.aspx?SupplierInfoId=2146&SupplierClickArea=SearchList&ViewType=Normal'
  //       },
  //       {
  //         name: 'test',
  //         localLink: 'about:blank'
  //       }
  //     ]
  //     return [testData[7]]
  //   }

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
        PupPool.use(async (browser) => {
          try {
            const page = await myPuppeteer.setupPage(browser)
            // Restore login cookies as cookies are now shared between puppeteer seasons and the page requires a login
            await page.setCookie(...holder.logbuyCookies)
            await page.goto(dataPoint.localLink, { waitUntil: 'networkidle2' })
            // See if either priority 1 or 2 button is found. Priority 1 button usually leads directly to the remote page
            // wheres the priority 2 button opens a frame with a pop up with a link to the remote page
            const linkPriority1 = await page.$('#ctl00_ctl00_Content_Content_HyperLink_WebSite:not(.displayNone)')
            let linkPriority2 = await page.$('.listingwrapper .button-green')
            if (linkPriority1) {
              try {
                const foundLink = await page.$eval('#ctl00_ctl00_Content_Content_HyperLink_WebSite', element => element.href)
                dataPoint.remoteLink0 = foundLink
                await page.goto(foundLink, { waitUntil: 'domcontentloaded' })
                dataPoint.remoteLink = await page.evaluate('document.domain')
                if ((dataPoint.remoteLink).contains('tradedoubler.com')) {
                  await page.waitForNavigation()
                  dataPoint.remoteLink = await evalRedirects(await page.evaluate('document.domain'), page)
                }
                return returnDataToMainThread(saveDataKey, dataPoint)
              } catch (error) {
                if (linkPriority2 != null) {
                  dataPoint.err0 = 'Priority 1 link following failed. Trying link 2'
                  // Go back to the page with links to external site
                  await page.goto(dataPoint.localLink, { waitUntil: 'networkidle2' })
                  dataPoint.remoteLinkPri1 = dataPoint.remoteLink0
                  // Must re-define linkPriority2 do to page navigation
                  linkPriority2 = await page.$('.listingwrapper .button-green')
                } else {
                  dataPoint.err0 = 'Priority 1 link following failed. No link 2 found'
                  return returnDataToMainThread(saveDataKey, dataPoint)
                }
              }
            }
            if (linkPriority2) {
              await linkPriority2.click()
              await page.waitForTimeout(2500)
              const frame = page.frames().find(frame => (frame.url()).includes('deal'))
              if (!frame) {
                throw new Error('No frame was found')
              }
              const foundLink = await frame.$eval('#ctl00_ctl00_Content_ClickOut_HyperLink_GoToDeal', element => element.href)
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
          returnDataToMainThread(saveDataKey, dataPoint)
        })
      } else {
        dataPoint.err5 = 'Err05: No link was found from result page'
        returnDataToMainThread(saveDataKey, dataPoint)
      }
    } catch (error) {
      dataPoint.err2 = 'Err02: Search for remote link: ' + error.message
      returnDataToMainThread(saveDataKey, dataPoint)
    }
  }

  /**
   * Look for knows redirect sited, and waits for a navigation before returning the URL
   * @param {string} URL
   * @param {Object} page - Puppeteer Page object
   * @returns {string}
   */
  async function evalRedirects (URL, page) {
    const reDirectSites = [
      'tradedoubler.com/',
      'doubleclick.net/',
      'bit.ly/',
      'salestring.com/',
      'chrome-error://'
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
}
exports.doLogbuyScrape = doLogbuyScrape

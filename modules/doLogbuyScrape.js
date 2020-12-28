'use strict'
const myPuppeteer = require('./my_puppeteer.js')

/**
 * Perform scape of data
 * @param {Object} browserHolder Puppeteer browser object
 * @param {Array<Object>} [masterData=null] Optional array containing objects with earlier results
 * @returns {Array<Object>} Array containing objects with results
 */
async function doLogbuyScrape (browserHolder, masterData = null) {
  try {
    const browser = await myPuppeteer.setupBrowser(browserHolder)
    const page = await myPuppeteer.setupPage(browser)
    // Go to login page and login
    console.log('Logbuy: Performing login')
    await goLogin(page)
    // Go to search page and scrape the content
    console.log('Logbuy: Data scrape search page starting')
    let scrapeData = await scrapeMainPage(page)
    console.log('Logbuy: Data scrape search page ending')
    // Debug: Insert test data from a file
    // let scrapeData = await testDataFile()
    // Debug: Insert test data from a predefined object
    // let scrapeData = testDataConst()
    // Loop scraped data and find the link the the external site
    scrapeData = await scrapeElementPages(page, scrapeData, masterData)
    console.log('Logbuy: Data scrape external sites done')
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

  async function goLogin (page) {
    await page.goto('https://www.mylogbuy.com/WebPages/Login/loginFrame.aspx?ReturnUrl=', { waitUntil: 'networkidle2' })
    await page.type('#ctl00_ctl00_Content_content_TextBox_Email', process.env.LOGBUY_USER)
    await page.type('#ctl00_ctl00_Content_content_TextBox_Password', process.env.LOGBUY_PASS)
    await Promise.all([
      page.waitForNavigation(),
      page.click('#ctl00_ctl00_Content_content_LinkButton_Login')
    ])
  }

  async function scrapeMainPage (page) {
    await page.goto('https://www.mylogbuy.com/WebPages/Search/List.aspx?q=', { waitUntil: 'networkidle2' })
    const scrapeData = []
    do {
      // Scrape result page's next page
      await page.waitFor('div.searchwrapper:not(.add)')
      scrapeData.push(...await page.evaluate(() => {
        // Class .add is used at adds placed within search results
        // Class .add is used for short limited discount and is not relevant
        const tableWithData = document.querySelectorAll('div.searchwrapper:not(.add) a > :not(.specialoffer)')
        // const tableWithData = document.querySelector('div.searchwrapper:not(.add)').children
        const sectionList = []
        for (const element of tableWithData) {
          const holderJson = {}
          try {
            holderJson.name = element.querySelector('.name').innerText
            // Mark the element in scope
            // element.querySelector('.name').style.border = 'thick solid red'
            holderJson.localLink = element.parentElement.href
            holderJson.discount = element.querySelector('.ribbon-wrapper').innerText
          } catch (error) {
            holderJson.err1 = 'Err01: Scraping search result page: ' + error.name
          }
          sectionList.push(holderJson)
        }
        return sectionList
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
    return scrapeData
  }

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

  async function scrapeElementPages (page, scrapeData, masterData) {
    page.setDefaultTimeout(15000)
    const dataLength = scrapeData.length
    let i1 = 100
    let i2 = 0
    for await (const dataPoint of scrapeData) {
      i1++
      i2++
      if (i1 > 59) {
        console.log('Logbuy: External scrape at #' + i2 + ' out of: ' + dataLength + ' [' + Math.floor(i2 / dataLength * 100) + ' %]')
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
          await page.goto(dataPoint.localLink, { waitUntil: 'networkidle2' })
          // Debug: Destroy primary link
          // await page.evaluate(() => {
          //   document.querySelector('#ctl00_ctl00_Content_Content_HyperLink_WebSite:not(.displayNone)').href = 'https://gardenrestaurant.dk/'
          // })
          // See if either priority 1 or 2 button is found
          const linkPriority1 = await page.$('#ctl00_ctl00_Content_Content_HyperLink_WebSite:not(.displayNone)')
          let linkPriority2 = await page.$('.listingwrapper .button-green')
          if (linkPriority1) {
            try {
              const foundLink = await page.$eval('#ctl00_ctl00_Content_Content_HyperLink_WebSite', element => element.href)
              dataPoint.remoteLink0 = foundLink
              try {
                await page.goto(foundLink, { waitUntil: 'networkidle2' })
              } catch (error) {
                // A few pages requests images in a forever loop, this is a fix for that
                await page.goto(foundLink, { waitUntil: 'domcontentloaded' })
              }
              dataPoint.remoteLink = await page.evaluate('document.domain')
              if ((dataPoint.remoteLink).contains('tradedoubler.com')) {
                await page.waitForNavigation()
                dataPoint.remoteLink = await evalRedirects(await page.evaluate('document.domain'), page)
              }
              continue
            } catch (error) {
              if (linkPriority2 != null) {
                dataPoint.err4 = 'Priority 1 link following failed. Trying link 2'
                // Go back to the page with links to external site
                await page.goto(dataPoint.localLink, { waitUntil: 'networkidle2' })
                dataPoint.remoteLinkPri1 = dataPoint.remoteLink0
                // Must re-define linkPriority2 do to page navigation
                linkPriority2 = await page.$('.listingwrapper .button-green')
              } else {
                dataPoint.err4 = 'Priority 1 link following failed. No link 2 found'
                continue
              }
            }
          }
          if (linkPriority2) {
            await linkPriority2.click()
            await page.waitFor(2500)
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
            dataPoint.err3 = 'No link to external site was found on local element page'
          }
        } else {
          dataPoint.err1 = 'No link was found from result page'
        }
      } catch (error) {
        dataPoint.err2 = 'Err02: Search for remote link: ' + error.name
      }
    }
    return scrapeData
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

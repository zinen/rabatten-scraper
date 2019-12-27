'use strict'
const puppeteer = require('puppeteer')

module.exports = {
  setupBrowser: async function (browserHolder) {
    if (!browserHolder) {
      browserHolder = await puppeteer.launch({
        // headless: false, // default is true
        // slowMo: 50, // only for debugging
        devtools: false, // default is false
        ignoreHTTPSErrors: true, // default is false
        args: [
          '--disable-infobars',
          // '--window-position=960,10',
          '--ignore-certifcate-errors',
          '--ignore-certifcate-errors-spki-list',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          // '--window-size=1280x800',
          // '--hide-scrollbars',
          '--lang=da-DK',
          '--disable-notifications',
          '--disable-extensions'
        ]
      })
    }
    return browserHolder
  },

  setupPage: async function (inBrowser) {
    const page = await inBrowser.newPage()
    await page.setViewport({
      width: 640,
      height: 800
    })
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36')
    const blockedResourceTypes = [
      'image',
      'media',
      'font',
      'texttrack',
      'object',
      'beacon',
      'csp_report',
      'imageset'
    ]
    const skippedResources = [
      'quantserve',
      'adzerk',
      // 'doubleclick', // Uses for redirections sometimes
      'adition',
      'exelator',
      'sharethrough',
      'cdn.api.twitter',
      'google-analytics',
      'googletagmanager',
      'google',
      'fontawesome',
      'facebook',
      'analytics',
      'optimizely',
      'clicktale',
      'mixpanel',
      'zedo',
      'clicksor',
      'tiqcdn',
      'addthis.com',
      'zendesk.com',
      'instagram.com',
      'mailchimp.com'
    ]
    await page.setRequestInterception(true)
    page.on('request', request => {
      const requestUrl = request._url.split('?')[0].split('#')[0]
      if (
        blockedResourceTypes.indexOf(request.resourceType()) !== -1 ||
        skippedResources.some(resource => requestUrl.indexOf(resource) !== -1)
      ) {
        request.abort()
      } else {
        request.continue()
      }
    })
    return page
  }
}

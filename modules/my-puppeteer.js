'use strict'
const puppeteer = require('puppeteer')
const genericPool = require('generic-pool')

module.exports = {
  initPuppeteerPool: ({
    // Based on: https://github.com/latesh/puppeteer-pool
    max = 5, // default
    // optional. if you set this, make sure to drain() (see step 3)
    min = 0, // default
    // specifies how long a resource can stay idle in pool before being removed
    idleTimeoutMillis = 30000, // default.
    // specifies the maximum number of times a resource can be reused before being destroyed
    maxUses = 10,
    testOnBorrow = true,
    puppeteerArgs = {
      // headless: false, // default is true
    // slowMo: 50, // only for debugging
      devtools: false, // default is false
      ignoreHTTPSErrors: true, // default is false
      args: [
        '--disable-infobars',
        // '--window-position=960,10',
        '--ignore-certificate-errors',
        '--ignore-certificate-errors-spki-list',
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

    },
    validator = () => Promise.resolve(true)
  } = {}) => {
    // TODO: randomly destroy old instances to avoid resource leak?
    const factory = {
      create: () => puppeteer.launch(puppeteerArgs).then(instance => {
        instance.useCount = 0
        return instance
      }),
      destroy: (instance) => {
        instance.close()
      },
      validate: (instance) => {
        return validator(instance)
          .then(valid => Promise.resolve(valid && (maxUses <= 0 || instance.useCount < maxUses)))
      }
    }
    const config = {
      max,
      min,
      idleTimeoutMillis,
      testOnBorrow
    }
    const pool = genericPool.createPool(factory, config)
    const genericAcquire = pool.acquire.bind(pool)
    pool.acquire = () => genericAcquire().then(instance => {
      instance.useCount += 1
      return instance
    })
    pool.use = (fn) => {
      let resource
      return pool.acquire()
        .then(r => {
          resource = r
          return resource
        })
        .then(fn)
        .then((result) => {
          pool.release(resource)
          return result
        }, (err) => {
          pool.release(resource)
          throw err
        })
    }
    return pool
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

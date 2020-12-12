'use strict'
const myFunc = require('./../../modules/myFunc.js')
const { holderService } = require('./../../settings.js')

/**
 * Compare the 2 newest data scrapes
 * @param {string} filePath File path to do search in dir.
 * @returns {Promise<Object>} Content of the file after analyses.
 */
async function compareLast (filePath) {
  const dirContent = await myFunc.readDir(filePath)
  if (dirContent.length > 1) {
    console.log('Comparing 2 newest file content now')
    const newestData = JSON.parse(await myFunc.readFile(dirContent[dirContent.length - 1]))
    const oldestData = JSON.parse(await myFunc.readFile(dirContent[dirContent.length - 2]))
    const newestLength = newestData.length
    const oldestLength = oldestData.length
    const newLinkArray = []
    for (let index = newestData.length - 1; index >= 0; index--) {
      const element = newestData[index]
      for (let index2 = oldestData.length - 1; index2 >= 0; index2--) {
        const element2 = oldestData[index2]
        if (element.name === element2.name) {
          if (element.remoteLink && element2.remoteLink) {
            const URL1 = element.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase()
            const URL2 = element2.remoteLink.replace(/^\w+:?\/\/(?:www\.)?\.?([^/]+)\/?.*$/, '$1').toLowerCase()
            if (URL1 !== URL2) {
              newLinkArray.push({
                name: element.name,
                from: URL2,
                to: URL1
              })
            }
          }
          newestData.splice(index, 1)
          oldestData.splice(index2, 1)
          break
        }
      }
    }
    return {
      addedServices: newestData,
      removedServices: oldestData,
      changedServices: newLinkArray,
      _analyse: {
        oldFile: dirContent[dirContent.length - 1],
        countOldFile: oldestLength,
        newFile: dirContent[dirContent.length - 2],
        countNewFile: newestLength,
        countRemoved: oldestData.length,
        countAdded: newestData.length,
        timestamp: new Date().toISOString()
      }
    }
  } else {
    console.log(`Comparing require multiple files, ${dirContent.length} was found`)
  }
}

async function run () {
  for (const service of holderService) {
    if (service.name === 'test') { continue }
    let result = await compareLast(service.scrapeOutPath)
    result = JSON.stringify(result, null, 2)
    await myFunc.writeFile('./logs/analyse-' + service.name + '.log', result)
  }
}
run()

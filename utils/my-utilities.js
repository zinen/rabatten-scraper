'use strict'
const fs = require('fs')
/**
 * Async delay, resolves after wait time
 * @param {number} msSec - Input as ms
 * @returns {Promise<resolve>}
 */
async function delay (msSec) {
  return new Promise(resolve => {
    setTimeout(() => resolve('DelayTimeout'), msSec)
  })
}
exports.delay = delay

/**
 * Async delay, rejects after wait time
 * @param {number} msSec - Input as ms
 * @returns {Promise<reject>}
 */
async function delayErr (msSec) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('DelayTimeout')), msSec)
  })
}
exports.delayErr = delayErr

/**
 * Write/overwrite data to file.
 * If the folder does not exist it gets created.
 * @param {string} fileContent - Filename to write to.
 * @param {string} inContent - Content to write to the file.
 */
async function writeFile (fileContent, inContent) {
  if (typeof fileContent !== 'string') { throw new TypeError('String file name is missing') }
  if (typeof inContent !== 'string') { throw new TypeError('String content is missing') }
  await new Promise(resolve => {
    // First check if the folder exists
    // Replace \\ with / in the file path
    const filePath = fileContent.replace(/\\/g, '/').split('/').slice(0, -1).join('/') + '/'
    fs.access(filePath, fs.constants.F_OK, (err) => {
      if (err) {
        fs.mkdirSync(filePath, { recursive: true })
      }
      resolve()
    })
  })
  // Then save the file
  return new Promise((resolve, reject) => {
    fs.writeFile(fileContent, inContent, 'utf8', function (err) {
      if (err) {
        console.warn('\x1b[31mAn error occurred while writing to file.\x1b[0m')
        reject(err)
      } else {
        console.log('\x1b[32mData written to file: "' + fileContent + '"\x1b[0m')
        resolve()
      }
    })
  })
}
exports.writeFile = writeFile

/**
   * Reads file content.
   * @param {string} filePath - File to read.
   * @returns {Promise<string>} - Content of file as string.
   */
async function readFile (filePath) {
  if (typeof filePath !== 'string') { throw new TypeError('String filePath is missing') }
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      }
      resolve(data)
    })
  })
}
exports.readFile = readFile

/**
   * Deletes a file.
   * @param {string} filePath - File path to file.
   * @returns {Promise} - Resolves if delete successful
   */
function deleteFile (filePath) {
  if (typeof filePath !== 'string') { throw new TypeError('String filePath is missing') }
  return new Promise((resolve, reject) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}
exports.deleteFile = deleteFile

/**
   * Reads dir content, sorted by filename.
   * @param {string} filePath - File path to folder to read.
   * @returns {Promise<Array>} - Content of dir as full path in a array.
   */
function readDir (filePath) {
  if (typeof filePath !== 'string') { throw new TypeError(`String filePath is missing, ${filePath}`) }
  return new Promise((resolve, reject) => {
    fs.readdir(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err)
      } else {
        data.sort((a, b) => a.localeCompare(b))
        resolve(data.map(filename => filePath + '/' + filename))
      }
    })
  })
}
exports.readDir = readDir

/**
 * Returns content of the last file in path, sorted by filename.
 * @param {string} filePath File path to do search in dir.
 * @returns {Promise<string>} Content of the file or null if empty folder.
 */
async function lastFileContent (filePath) {
  if (typeof filePath !== 'string') { throw new TypeError('String filePath is missing') }
  const fileContent = await readDir(filePath)
  if (fileContent.length === 0) { return null }
  const lastFile = fileContent[fileContent.length - 1]
  const lastFileContent = await readFile(lastFile)
  return lastFileContent
}
exports.lastFileContent = lastFileContent

/**
 * Deletes content of a folder.
 * @param {string} filePath File path to folder.
 * @returns {Promise<array>} Content of the folder. Empty if all files was deleted.
 */
async function clearFolder (filePath) {
  if (typeof filePath !== 'string') { throw new TypeError('String filePath is missing') }
  try {
    const content = await readDir(filePath)
    content.forEach(async (element) => {
      await deleteFile(element)
    })
    return true
  } catch (error) {
    return false
  }
}
exports.clearFolder = clearFolder

/**
 * Evaluate a fair number to divide the input into, for debugging loops
 * @param {number} amount
 * @param {number} max Optional: Allow top number to return, default=20
 * @returns {number}
 */
function fairSubParts (amount, max = 20) {
  const v2 = amount <= 10 ? amount : amount / 10
  const v3 = Math.min(v2, max)
  return Math.round(v3)
}
exports.fairSubParts = fairSubParts

function random (min = 0, max = 1) {
  return (max - min) * Math.random() + min
}
exports.random = random

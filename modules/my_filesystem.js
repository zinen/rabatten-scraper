'use strict'
const fs = require('fs')
// import * as fs from 'fs'

module.exports = {
/**
 * Write data to file.
 * Does not create folder, this must be in place before.
 * @param {string} inFileName - Filename to write to.
 * @param {string} inContent - Content to write to the file.
 */
  writeFile: async function (inFileName, inContent) {
    return new Promise((resolve, reject) => {
      fs.writeFile(inFileName, inContent, 'utf8', function (err) {
        if (err) {
          console.warn('\x1b[31mAn error occured while writing JSON Object to File.\x1b[0m')
          reject(err)
        } else {
          console.log('\x1b[32mDate scrape succes. Written to file "' + inFileName + '"\x1b[0m')
          resolve()
        }
      })
    })
  },

  /**
   * Reads file conent.
   * @param {string} file - File to read.
   * @returns {Promise<string>} - Content of file as string.
   */
  readFile: async function (file) {
    return new Promise((resolve, reject) => {
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) {
          console.error(err)
          reject(err)
        }
        resolve(data)
      })
    })
  },

  /**
   * Reads dir conent, sorted by filename.
   * @param {string} filePath - File path to folder to read.
   * @returns {Promise<Array>} - Content of dir as full path in a array.
   */
  readDir: async function (filePath) {
    return new Promise((resolve, reject) => {
      fs.readdir(filePath, 'utf8', (err, data) => {
        if (err) {
          console.error(err)
          reject(err)
        }
        data.sort((a, b) => a.localeCompare(b))
        resolve(data.map(filename => filePath + '/' + filename))
      })
    })
  }

}

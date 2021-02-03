'use strict'
const myFunc = require('./../modules/myFunc.js')
const assert = require('assert').strict

let errorHappened = false
async function run () {
  try {
    const dirContent = await myFunc.readDir('./dist')
    assert.notStrictEqual(dirContent.length, 0, `Expected content of ./dist to more than 0 files, result was ${dirContent.length}`)
    for (const file of dirContent) {
      try {
        const fileContent = await myFunc.readFile(file)
        let isValidJSON = true
        let result
        try { result = JSON.parse(fileContent) } catch { isValidJSON = false }
        assert.ok(isValidJSON, `Expected content of ${file} to be parse-able as JSON`)
        assert.notStrictEqual(result.length, 0, `Expected length of ${file} to be more than 0, result was ${result.length}`)
        assert.ok(result instanceof Array, `Expected content of ${file} to be an array`)
        assert.ok(result[0] instanceof Array, `Expected content of ${file} to be an array of arrays`)
      } catch (error) {
        console.warn(error.message)
        errorHappened = true
      }
    }
  } catch (error) {
    console.warn(error.message)
    errorHappened = true
  } finally {
    if (errorHappened) {
      console.log('\x1b[31mx\x1b[0m Something went wrong during test')
      process.exit(1)
    } else {
      console.log('\x1b[32m✓\x1b[0m All tests completed successfully. Files inside ./dist is parsable as JSON')
    }
  }
}
run()

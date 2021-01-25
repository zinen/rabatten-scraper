'use strict'
const myFunc = require('./../modules/myFunc.js')
const assert = require('assert').strict

async function run () {
  try {
    const dirContent = await myFunc.readDir('./dist')
    assert.notStrictEqual(dirContent.length, 0)
    for (const file of dirContent) {
      const fileContent = await myFunc.readFile(file)
      let isValidJSON = true
      let result
      try { result = JSON.parse(fileContent) } catch { isValidJSON = false }
      assert.ok(isValidJSON)
      assert.notStrictEqual(result.length.length, 0)
    }
    console.log('\x1b[32m✓\x1b[0m All tests completed successfully. Files inside ./dist is parsable as JSON')
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}
run()

'use strict'
const myUtil = require('./my-utilities.js')

const run = async (outputFilePath = './logs/temp.log') => {
  try {
    await myUtil.deleteFile(outputFilePath)
  } catch (error) {
    // ok if file cant be deleted, it might not be there
  }
  const folderContent = await myUtil.readDir('./logs/analyzeLastScrape/')
  let outputText = ''
  for (const filePath of folderContent) {
    // File
    let fileContent = await myUtil.readFile(filePath)
    fileContent = JSON.parse(fileContent)
    // Check date of new file
    let timestampNewFile = fileContent._analyze.newFile.split(/[/.]/)
    timestampNewFile = timestampNewFile[timestampNewFile.length - 2] || '2020-01-01'
    timestampNewFile = timestampNewFile.substring(0, 10)
    timestampNewFile = new Date(timestampNewFile)
    const lastWeek = (new Date()).setDate((new Date()).getDate() - 7)
    if (timestampNewFile < lastWeek) {
      // console.error(`Date within ${filePath} show it was too old to be considered as new data.`)
      outputText += ` - **${fileContent._analyze.name}** - No changes to entries (last ${fileContent._analyze.countNewFile}) due to old scrape file\n`

      continue
    }
    outputText += ` - **${fileContent._analyze.name}** - total entries ${fileContent._analyze.countNewFile} (added ${fileContent._analyze.countAdded} / removed ${fileContent._analyze.countRemoved})\n`
  }
  if (outputText === '') {
    console.error('No input data could be used for generating pull request content. Run either a new scrape or a new analyze')
    process.exitCode = 1
    return
  }

  // console.log('---content of file:')
  // console.log(outputText)
  // console.log('--- content end.')
  await myUtil.writeFile(outputFilePath, outputText)
}

if (process.argv.length > 2) {
  run(process.argv[2])
} else {
  run()
}

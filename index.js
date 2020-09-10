#!/usr/bin/env node
const { Command } = require("commander")
const chalk = require("chalk")
const program = new Command()
const dl = require("drivelist")
const fs = require("fs")
const path = require("path")
const log = console.log
const figlet = require("figlet")
const commander = require("commander")
const {prompt} = require('inquirer')
const { type } = require("os")
const { error } = require("console")

program.version("0.0.1")
// greeting
figlet(
  "BACKER",
  {
    font: "Ghost",
  },
  (err, data) => {
    if (err) {
      log(chalk.red("err"))
      return
    }
    log(chalk.green("\n\n\n\n" + data))
    log(
      chalk.greenBright("BACKER backup utility - v" + program.version() + "\n")
    )
   
  }
)

let backupVolume = "volume not found"
let backupPath = "path not found"
let drives = getVolumes()

async function createIndex() {
  let driveList = await dl.list()
  let indexArray = []
  let lastDrive = ""
  driveList.forEach((drive, index) => {
    let driveInfo = drive.mountpoints[0]
    // ignore double volume listings
    if (driveInfo.path === lastDrive) {
      return
    }
    // ignore if drive is system drive
    if(drive.isSystem){
        return
    }
    indexArray.push({
      path: driveInfo.path,
      label: driveInfo.label,
    })
    lastDrive = driveInfo.path
  })
  if(indexArray.length === 0){
      log(chalk.red('Found no compatible volumes.'))
      log(chalk.red('Try attaching an external or non-system drive.')) 

  }
  return indexArray
}
async function getVolumes() {
  let drives = await dl.list()
  return drives
}

// returns boolean if found config at root of drive
function checkDriveForConfig(path, label){
    let found = false
    try{
        let files = fs.readdirsync(path, {})
    }
    catch(err){
        log(chalk.red(err))
        return
    }
    // check all files
    files.forEach(file=>{
        if(file.includes(config.backer)){
            found = true
            return
        }
    })
    return found
    
}

program.command("debug").action(async () => {
  let drives = await dl.list()
  drives.forEach((drive) => {
    log(chalk.cyan(JSON.stringify(drive)))
  })
})

// searches for backup config file in root of every mounted volume
// format for config <volumelabel>.config.backertool
async function createConfig() {}
program
  .command("createconfig")
  .description("Create a backup config on volume if one is not present.")
  .action(async () => {
    // first load in drive query data
    let index = await createIndex()
    if(index.length < 1){
        log(chalk.red('No compatible drives found. [Must not be a system drive (red-only)]'))
        return
    }
    // create prompt for which drive index to config
    index.forEach((drive, driveIndex) => {
      log(chalk.green(driveIndex)+ ' '+ drive.label + ' - ' + drive.path + '\n')
    })
    let promptAnswer = await prompt([{
        type: 'input',
        message: 'Select volume index...',
        name: 'drive-index'
    }])
    let selected = promptAnswer['drive-index']
    if(!index[selected]){
        log(chalk.red('Invalid Index'))
        return
    }
    log(chalk.cyan('Checking volume ' + selected + ' ' + index[selected].label ))
    //now check for existing config on drive
    let drivePath = index[selected].path
    let files = fs.readdirSync(drivePath)
    files.forEach((file, fileIndex)=>{
        if(file.includes('config.backer')){
            log(chalk.red('Config already exists on volume - ' + index[selected].label))
            return
        }
      

    })
      // config doesn't exist, create new one here
      fs.writeFileSync(path.join(drivePath, `config.backer`), 'testdata')
    
    
  })

// edit a config
program.command('edit config').description('Select a config to edit').action(async ()=>{
    let index = await createIndex()
    index.forEach((driveObj)=>{
        if(checkDriveForConfig(driveObj.path, driveObj.label)){
            log(chalk.greenBright('Found config in ' + driveObj.label))
            return
        }
        else{
            log(chalk.red('No config in '+driveObj.label))
        }
    })
})


program
  .command("check")
  .description("Check if backup volume is mounted")
  .action(async () => {
    let drives = await dl.list()
    drives.forEach((drive, index) => {
      log(drive.mountpoints)
      //get drive path
      let drivePath = drive.mountpoints[0].path
      //read in filenames from base directory of volume
      files = fs.readdirSync(drivePath)
      log(chalk.white(files))
      files.forEach((fileString) => {
        log(fileString)
        if (fileString.includes("config.backer")) {
          log(
            chalk.green(
              "Found backup drive in volume " + drive.mountpoints[0].label
            )
          )
        }
      })

      // log(chalk.red('Backup volume not found.'))
    })
  })

program
  .command("list")
  .description("Lists things.")
  .action(async () => {
    let index = await createIndex()
    // return if no compatible found
    if(index.length < 1){
        log(chalk.red('No non-system drives found.\n'))
        return
    }
    log(chalk.green("Available Volumes:"))
    index.forEach((volume, indexIndex) => {
      log(chalk.cyan(volume.label + " @ path - " + volume.path))
    })
    log("\n")
  })

program.parse(process.argv)

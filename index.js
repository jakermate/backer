#!/usr/bin/env node
const { Command } = require("commander")
const chalk = require("chalk")
const program = new Command()
const dl = require("drivelist")
const fs = require('fs')
const path = require('path')
const log = console.log

log(chalk.green.bgGrey("Backup Tool"))

program.version("0.0.1")

let backupVolume = 'volume not found'
let backupPath = 'path not found'
let drives = getVolumes()


async function createIndex(){
    let driveList = await dl.list()
    let indexArray = []
    driveList.forEach((drive, index)=>{
        indexArray.push({
            path: drive.mountpoints[0].path,
            label: drive.mountpoints[0].label
        })
    })
    return indexArray
}
async function getVolumes(){
    let drives = await dl.list()
    return drives
}



// searches for backup config file in root of every mounted volume
// format for config <volumelabel>.config.backertool
async function findBackupDrive(){

}
function createConfig(){

}
program.command('createconfig <label>').description('Create a backup config on volume if one is not present.').action(()=>{
    // first load in drive query data
    
})

program
  .command("check")
  .description("Check if backup volume is mounted")
  .action(async () => {
    let drives = await dl.list()
    drives.forEach((drive,index)=>{
        log(drive.mountpoints)
        //get drive path
        let drivePath = drive.mountpoints[0].path
        //read in filenames from base directory of volume
        files = fs.readdirSync(drivePath)
        log(chalk.white(files))
        files.forEach(fileString=>{
            log(fileString)
            if(fileString.includes('config.backer')){
                log(chalk.green('Found backup drive in volume '+ drive.mountpoints[0].label))
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
    log(chalk.green('Available Volumes:'))
    index.forEach((volume, index)=>{
        log(chalk.cyan(volume.label + ' @ path - ' + volume.path))

    })
  })

program.parse(process.argv)

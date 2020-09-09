#!/usr/bin/env node
const { Command } = require("commander")
const chalk = require("chalk")
const program = new Command()
const dl = require("drivelist")
const log = console.log

log(chalk.green.bgGrey("Backup Tool"))

program.version("0.0.1")

let backupVolume = 'volume not found'
let backupPath = 'path not found'

function getVolume(){

}

program
  .command("check")
  .description("Check if backup volume is mounted")
  .action(async () => {
    let drives = await dl.list()
    drives.forEach((drive,index)=>{
        log(drive.mountpoints)
        if(drive.mountpoints[0].label === 'rootext'){
            backupVolume = drive
            backupPath = drive.mountpoints[0].path
            log(chalk.green('Backup volume found: ') + chalk.cyan(JSON.stringify(backupVolume)) + ' at path: ' + chalk.green(backupPath))
            return
        }
        log(chalk.red('Backup volume not found.'))
    })
  })

program
  .command("list")
  .description("Lists things.")
  .action(() => {
    console.log("Listed")
  })

program.parse(process.argv)

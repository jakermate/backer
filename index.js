#!/usr/bin/env node
const { Command } = require("commander")
const chalk = require("chalk")
const program = new Command()
const dl = require("drivelist")
const log = console.log

log(chalk.green.bgGrey("Backup Tool"))

program.version("0.0.1")

program
  .command("check")
  .description("Check if backup volume is mounted")
  .action(async () => {
    let drives = await dl.list()
    log(drives)
  })

program
  .command("list")
  .description("Lists things.")
  .action(() => {
    console.log("Listed")
  })

program.parse(process.argv)

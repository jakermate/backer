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
const { prompt } = require("inquirer")
const { type } = require("os")
const { error } = require("console")
const readline = require("readline")
const fsx = require("fs-extra")
const getSize = require("get-folder-size")
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
    if (index.length < 1) {
      log(
        chalk.red(
          "No compatible drives found. [Must not be a system drive (red-only)]"
        )
      )
      return
    }
    // create prompt for which drive index to config
    index.forEach((drive, driveIndex) => {
      log(
        chalk.green(driveIndex) + " " + drive.label + " - " + drive.path + "\n"
      )
    })
    let promptAnswer = await prompt([
      {
        type: "input",
        message: "Select volume index...",
        name: "drive-index",
      },
    ])
    let selected = promptAnswer["drive-index"]
    if (!index[selected]) {
      log(chalk.red("Invalid Index"))
      return
    }
    log(chalk.cyan("Checking volume " + selected + " " + index[selected].label))
    //now check for existing config on drive
    let drivePath = index[selected].path
    let files = fs.readdirSync(drivePath)
    files.forEach((file, fileIndex) => {
      if (file.includes("config.backer")) {
        log(
          chalk.red(
            "Config already exists on volume - " + index[selected].label
          )
        )
        return
      }
    })
    // config doesn't exist, create new one here
    fs.writeFileSync(path.join(drivePath, `config.backer`), "testdata")
  })

// delete config
program
  .command("delete config")
  .description("Delete existing config")
  .action(async () => {
    let index = await createIndex()
    let configs = []
    index.forEach((drive, driveIndex) => {
      // if config found on drive
      if (checkDriveForConfig(drive.path, drive.label)) {
        configs.push({
          path: drive.path,
          label: drive.label,
        })
        log(
          chalk.green(driveIndex) +
            " " +
            chalk.cyan(drive.label) +
            " - " +
            drive.path +
            "\n"
        )
      }
    })

    if (configs.length === 0) {
      log(chalk.red("No volumes found with configs."))
      return
    }
    // prompt which drive config to delete
    prompt([
      {
        message: "Which config would you like to erase?",
        type: "input",
        name: "drive-to-delete",
      },
    ]).then((data) => {
      // if selection is invalid (drive doesnt exist), exit
      if (!configs[data["drive-to-delete"]]) {
        log(chalk.red("Invalid selection. Exiting..."))
        return
      }
      log(
        chalk.green(
          "Selected drive " +
            data["drive-to-delete"] +
            " to erase backer config."
        )
      )
      // erase config
      log(configs[data["drive-to-delete"]])
      fs.unlink(
        path.join(configs[data["drive-to-delete"]].path, "config.backer"),
        (err) => {
          if (err) {
            log(chalk.red("Config deletion error. Exiting."))
            return
          }
          log(
            chalk.green("Success deleting config on drive ") +
              chalk.cyan(
                " " +
                  configs[data["drive-to-delete"]].label +
                  " @ " +
                  configs[data["drive-to-delete"]].path
              )
          )
        }
      )
    })
  })

// edit a config
program
  .command("edit config")
  .description("Select a config to edit")
  .action(async () => {
    let index = await createIndex()
    log(chalk.cyan("Listing all available volumes...\n"))
    let count = 0
    index.forEach((driveObj, driveObjIndex) => {
      if (checkDriveForConfig(driveObj.path, driveObj.label)) {
        log(
          chalk.gray(driveObjIndex + " ") +
            chalk.greenBright(driveObj.label) +
            " @ " +
            chalk.green(driveObj.path + " ") +
            chalk.green.bgGray("configured")
        )
        count++
        return
      } else {
        count++
        log(chalk.red("No config in " + driveObj.label))
      }
    })
    log(chalk.gray("\n"+count + " volumes found."))
    log(
      chalk.gray(
        "Select config to edit, or select empty drive to initialize."
      )
    )
  })

program
  .command("backup")
  .description("Backup to a drive with a defined config file.")
  .action(async () => {
    let index = await createIndex()
    if (index.length === 0) {
      log(chalk.red("No backup drives available."))
      return
    }
    index.forEach((drive, driveIndex) => {
      if (!checkDriveForConfig(drive.path, drive.label)) {
        return
      }
      log(
        chalk.green(driveIndex + " Volume " + drive.label + " @ " + drive.path)
      )
    })
    prompt([
      {
        message: "\nSelect drive to backup with.",
        name: "selectedDrive",
        type: "input",
      },
    ]).then(async (data) => {
      if (!index[data["selectedDrive"]]) {
        log(chalk.red("Invalid Index"))
        return
      }
      log(
        chalk.green(
          "\nSelected drive " + data["selectedDrive"] + " to initiate backup."
        )
      )
      // load in config
      log(
        chalk.cyan(
          "\nCONFIG FOR VOLUME " +
            index[data["selectedDrive"]].label +
            " @ " +
            index[data["selectedDrive"]].path
        )
      )
      // loop through config contents and display each directory to backup
      let readConfig = readline.createInterface({
        input: fs.createReadStream(
          path.join(index[data["selectedDrive"]].path, "config.backer")
        ),
      })
      let backupPaths = []
      readConfig.on("line", (line) => {
        if (!line) {
          return
        }
        backupPaths.push(line)
        log(chalk.yellow(line))
      })
      // get sizes for progress display
      let totalSize = 0
      log(chalk.gray("Calculating size..."))
      backupPaths.forEach((directory) => {
        let dirSize = getDirectorySize(directory)
        totalSize += dirSize
      })
      log(chalk.green("Backup size: " + totalSize + "b."))
      prompt([
        {
          message: "Are you sure you want to backup?",
          name: "answer",
          default: "Yes",
          type: "input",
        },
      ]).then((answer) => {
        // log(chalk.red(JSON.stringify(answer)))
        if (
          answer["answer"] !== "Y" &&
          answer["answer"] !== "y" &&
          answer["answer"] !== "yes" &&
          answer["answer"] !== "YES" &&
          answer["answer"] !== "Yes"
        ) {
          log(chalk.red("Invalid affirmation. Operation aborted."))
          return
        }
        // create backup index from config
        let d = new Date() // date for unique directory
        date = d.getTime().toString()

        // create backup log file and place in main directory
        let newDirectory = path.join(
          index[data["selectedDrive"]].path,
          `backup_${date}`
        )
        let backerLog = ""
        backupPaths.forEach((path, pathIndex) => {
          backerLog += path + "\n"
        })
        fsx.mkdir(newDirectory, (err) => {
          if (err) {
            return
          }
        })
        fsx.writeFileSync(path.join(newDirectory, "log.backer"), backerLog)

        // copy each directory
        backupPaths.forEach((backupPath, backupPathIndex) => {
          let source = backupPath
          let destination = path.join(
            index[data["selectedDrive"]].path,
            `backup_${date}`,
            path.basename(backupPath)
          )
          log(
            chalk.gray(
              "Backing up directory - " + source + " to " + destination
            )
          )
          let count = 0
          fsx.copy(source, destination, (err) => {
            if (err) {
              log(chalk.red(err))
            }
            count++
            log(
              chalk.green(
                `${count} of ${backupPaths.length} ` +
                  source +
                  " to " +
                  destination +
                  " - success"
              )
            )
          })
        })
      })
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
    if (index.length < 1) {
      log(chalk.red("No non-system drives found.\n"))
      return
    }
    log(chalk.green("Available Volumes:"))
    // loop through each volume
    index.forEach((volume, indexIndex) => {
      // check for existing config
      if (checkDriveForConfig(volume.path, volume.label)) {
        log(
          chalk.white.bold(`${indexIndex} - `) +
            chalk.dim(
              `${volume.device}:` +
                volume.label +
                ` (${volume.description}) @ path - ` +
                volume.path
            ) +
            chalk.greenBright(" - configured for backup")
        )
      } else {
        log(
          chalk.white(`${indexIndex} - `) +
            chalk.gray(
              `${volume.device}:` +
                volume.label +
                ` (${volume.description}) @ path - ` +
                volume.path
            ) +
            chalk.yellow("unconfigured")
        )
      }
    })
    log("\n")
    // allow user to select drive for actions
    prompt([
      {
        message: "Select a drive or exit (ctrl+c).",
        name: "driveSelect",
        type: "input",
      },
    ])
  })

program.parse(process.argv)

async function getDirectorySize(directory) {
  let returnSize = 0

  getSize(dir, (err, size) => {
    if (err) {
      log(chalk.red("Error determining size of " + directory))
      return
    }
    log(chalk.green("Directory " + directory + " total size: " + size))
    returnSize = size
  })
  return returnSize
}

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
    if (drive.isSystem) {
      return
    }
    indexArray.push({
      size: drive.size,
      device: drive.device,
      description: drive.description,
      path: driveInfo.path,
      label: driveInfo.label,
    })
    lastDrive = driveInfo.path
  })
  if (indexArray.length === 0) {
    log(chalk.red("Found no compatible volumes."))
    log(chalk.red("Try attaching an external or non-system drive."))
  }
  return indexArray
}

// returns boolean if found config at root of drive
function checkDriveForConfig(path, label) {
  let found = false
  let files
  try {
    files = fs.readdirSync(path)
  } catch (err) {
    log(chalk.red(err))
    return
  }
  // check all files
  files.forEach((file) => {
    if (file.includes("config.backer")) {
      found = true
      return
    }
  })
  return found
}

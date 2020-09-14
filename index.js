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
    log(chalk.cyan("Searching all available volumes..."))
    let index = await createIndex()
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
        chalk.gray(driveObjIndex + " ") +
          chalk.yellow(driveObj.label) +
          " @ " +
          chalk.yellow(driveObj.path + " ") +
          chalk.yellow.bgGray("unconfigured")
      }
    })
    log(chalk.gray("\n" + count + " volumes found."))
    if (index.length < 1) {
      log(chalk.red("No configs to edit. Exiting..."))
      return
    }
    log(
      chalk.gray("Select config to edit, or select empty drive to initialize.")
    )
    prompt([
      {
        message: "Select Volume (index number):",
        name: "selectedVolume",
        type: "input",
      },
    ])
      .then((value) => {
        if (!index[value["selectedVolume"]]) {
          log(chalk.red("Invalid Selection."))
          return
        } else {
          editConfig(index[value["selectedVolume"]].path)
        }
      })
      .catch((err) => {
        throw err
      })
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

      let readConfig = fs.readFileSync(
        path.join(index[data["selectedDrive"]].path, "config.backer"),
        "utf-8"
      )
      let lines = readConfig.split(/\r?\n/)
      let backupPaths = []
      lines.forEach((pathLine) => {
        if (pathLine) {
          backupPaths.push(pathLine)
          log(chalk.yellow("dir: " + pathLine))
        }
      })
      // get sizes for progress display
      log(chalk.gray("Calculating size..."))
      let totalSize = await getBackupSize(backupPaths)

      log(chalk.green("Est. backup size: " + totalSize / 1000000 + "Mb."))
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

async function getBackupSize(backupPathArray) {
  return new Promise((resolve, reject) => {
    let returnSize = 0
    let countNeeded = backupPathArray.length
    log(chalk.green("need " + countNeeded))
    let count = 0
    backupPathArray.forEach((pth) => {
      getSize(pth, (err, size) => {
        if (err) {
          log(chalk.red("Error determining size of " + directory))
          return
        }
        log(chalk.green("Directory " + pth + " total size: " + size))
        returnSize += size
        count++
        if (count === countNeeded) {
          log(chalk.green("resolving"))
          resolve(returnSize)
        }
      })
    })
  })
}

async function editConfig(configPath) {
  let configFile = fs.readFileSync(
    path.join(configPath, "config.backer"),
    "utf-8"
  )
  let configPaths = configFile.split(/\r?\n/)
  // make sure no empty lines
  configPaths.forEach((index, indx) => {
    if (!configPaths[indx]) {
      configPaths.pop()
    }
  })
  // enter edit mode and loop until editing is done
  let editMode = true
  while (editMode) {
    let getUpdatedFile = fs.readFileSync(path.join(configPath, 'config.backer'), 'utf-8')
    let configPaths = getUpdatedFile.split(/\r?\n/)
    configPaths.forEach((pth, indx) => {
      if (pth) {
        log(chalk.white(indx) + chalk.green(" " + pth))
      }
    })
    log(
      chalk.white(configPaths.length) +
        " " +
        chalk.green.bgGray("add new directory")
    )
    let ans = await prompt([
      {
        message: "Select option. (ctrl+c to exit)",
        type: "input",
        name: "selection",
      },
    ])
    if (configPaths[ans["selection"]]) {
      // call edit menu for this path
    }
    if (ans["selection"] == configPaths.length) {
      //call add new path menu
      let newPath = await prompt([
        {
          message: "Enter new path/directory and hit enter.",
          type: "input",
          name: "newPath",
        },
      ])
      if (newPath["newPath"]) {
        // add new path to index
        fs.appendFileSync(
          path.join(configPath, "config.backer"),
          `${newPath["newPath"]}\n`
        )
        log(chalk.green("Added " + newPath["newPath"] + "!"))
      }
    } else {
      log(chalk.red("Invalid response."))
      return
    }
  }
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

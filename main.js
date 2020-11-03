/* 
    Copyright (C) 2020  BadAimWeeb/TeamDec1mus

    The start of everything. Litteraly everything.
*/

(async () => {
    let bootupStart = Date.now();

    let fs = require("fs");
    let path = require("path");

    if (!fs.existsSync(path.join(process.cwd(), ".env"))) {
        await fs.promises.copyFile(
            path.join(process.cwd(), ".env.default"),
            path.join(process.cwd(), ".env")
        )
    }

    require("dotenv").config();

    let __GLOBAL = {};

    let cModifier = require("./app/classModifier");
    __GLOBAL = {
        ...__GLOBAL,
        ...cModifier
    }

    __GLOBAL.Logger = require("./app/getLoggerClass")(__GLOBAL);
    let logger = new __GLOBAL.Logger("INTERNAL");

    console.original = {
        log: console.log,
        error: console.error
    };

    console.log = logger.log;
    console.error = logger.log.bind(logger, "[ERROR]");

    logger.log("Booting up...");

    global.ensureExists(path.join(process.cwd(), ".data"));

    // Expected sequence: Get storage => Load plugin => Check update => Load interface/login

    // Get storage
    let storageGetter = new (require("./app/getStorage"))();
    let storage = await storageGetter.getStorage();
    __GLOBAL.storage = storage;

    // Load plugin

    // Update
    try {
        let updateLog = new __GLOBAL.Logger("Updater");
        __GLOBAL.botUpdater = new (require("./app/updater"))(updateLog.log);

        async function checkUpdate() {
            let diff;
            switch (String(process.env.UPDATER_AUTOUPDATE).toLowerCase()) {
                case "check":
                    diff = await __GLOBAL.botUpdater.getDiff();
                    if (diff) {
                        updateLog.log(`There's a new version available! (you're behind by ${diff === Infinity ? "100+" : diff} version)`);
                    }
                    return;
                case "auto":
                case "auto-restart":
                    diff = await __GLOBAL.botUpdater.getDiff();
                    if (diff) {
                        updateLog.log(`There's a new version available! (you're behind by ${diff === Infinity ? "100+" : diff} version)`);
                        updateLog.log(`Updating...`);
                        let status = await __GLOBAL.botUpdater.performUpdate();
                        if (status) {
                            if (process.env.UPDATER_AUTOUPDATE === "auto-restart") {
                                updateLog.log("Update finished. Restarting the bot...");
                                global.exitIsUpdate = true;
                                process.exit(7378278);
                            } else {
                                updateLog.log("Update finished. Please restart the bot for changes to take effect.");
                            }
                        }
                    }
                    return;
                case "none":
                    return;
                default:
                    logger.log(`Invalid value "${process.env.UPDATER_AUTOUPDATE}" in config. (config key: UPDATER_AUTOUPDATE).`);
            }
        }

        await checkUpdate();

        let interval = parseInt(process.env.UPDATER_CHECK_INTERVAL);
        if (isNaN(interval)) {
            logger.log(`Invalid value ${process.env.UPDATER_CHECK_INTERVAL} in config. (not a valid number) (config key: UPDATER_CHECK_INTERVAL)`, ex);
        }

        if (interval <= 0) return;
        __GLOBAL.updateInterval = setInterval(checkUpdate, interval * 60000);
    } catch (ex) {
        logger.log("An error occured while trying to execute UPDATE_BOT:", ex);
    }

    global.startupFinished = true;
    logger.log(`Finished booting. (${(Date.now() - bootupStart) / 1000}s)`);

    __GLOBAL.replConsole = require("./app/repl");
})(); 
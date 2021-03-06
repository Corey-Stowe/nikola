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

    let __GLOBAL = {
        plugins: {}
    };
    global.__GLOBAL = __GLOBAL;

    let cModifier = require("./app/classModifier");
    Object.assign(__GLOBAL, cModifier);

    __GLOBAL.Logger = require("./app/getLoggerClass")(__GLOBAL);
    let logger = new __GLOBAL.Logger("INTERNAL");

    console.original = {
        log: console.log,
        error: console.error
    };

    console.log = logger.log;
    console.error = logger.error;

    logger.log("Booting up...");

    global.ensureExists(path.join(process.cwd(), ".data"));

    // Expected sequence: Get messages (language) => Get storage => Get NPM handler => Load plugin => Check update => Load interface/login

    // Get messages (language)
    __GLOBAL.getLang = require("./app/languageHandler");

    // Get storage
    logger.verb("Executing tasks: Getting storage...");
    let storageGetter = new (require("./app/getStorage"))();
    let storage = await storageGetter.getStorage();
    __GLOBAL.storage = storage;

    // Get NPM handler
    logger.verb("Executing tasks: Getting NPM for plugins...");
    let npmPluginHandler = await require("./app/npmPackageHandler")(__GLOBAL);
    __GLOBAL.npmPluginHandler = npmPluginHandler;

    // Load plugin
    __GLOBAL.ensureExists(path.join(process.cwd(), process.env.PLUGIN_LOCATION));
    logger.verb("Executing tasks: Getting plugin format handler...");
    __GLOBAL.pluginFormatHandler = new (require("./app/pluginFormatHandler"))(__GLOBAL);
    logger.log("Searching for plugins...");
    await require("./app/pluginFinder")(__GLOBAL);

    // Update
    try {
        let updateLog = new __GLOBAL.Logger("Updater");
        __GLOBAL.botUpdater = new (require("./app/updater"))(updateLog.log);

        async function checkUpdate() {
            let diff;
            switch (String(process.env.UPDATER_AUTOUPDATE).toLowerCase()) {
                case "check":
                    logger.verb("Executing tasks: Check for updates...");
                    diff = await __GLOBAL.botUpdater.getDiff();
                    if (diff) {
                        updateLog.log(`There's a new version available! (you're behind by ${diff === Infinity ? "100+" : diff} version)`);
                    }
                    return;
                case "auto":
                case "auto-restart":
                    logger.verb("Executing tasks: Check for updates...");
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
                    logger.error(`Invalid value "${process.env.UPDATER_AUTOUPDATE}" in config. (config key: UPDATER_AUTOUPDATE).`);
            }
        }

        await checkUpdate();

        let interval = parseInt(process.env.UPDATER_CHECK_INTERVAL);
        if (isNaN(interval)) {
            logger.error(`Invalid value ${process.env.UPDATER_CHECK_INTERVAL} in config. (not a valid number) (config key: UPDATER_CHECK_INTERVAL)`, ex);
        }

        if (interval <= 0) return;
        __GLOBAL.updateInterval = setInterval(checkUpdate, interval * 60000);
    } catch (ex) {
        logger.error("An error occured while trying to execute UPDATE_BOT:", ex);
    }

    global.startupFinished = true;
    logger.log(`Finished booting. (${(Date.now() - bootupStart) / 1000}s)`);

    __GLOBAL.replConsole = require("./app/repl");
})(); 
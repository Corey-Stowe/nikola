(async () => {
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
    console.error = logger.log.bind(logger, ["[ERROR]"]);

    logger.log("Booting up...");

    // Update
    try {
        let updateLog = new __GLOBAL.Logger("Updater");
        __GLOBAL.botUpdater = new (require("./app/updater"))(updateLog.log);

        async function checkUpdate() {
            switch (String(process.env.UPDATER_AUTOUPDATE).toLowerCase()) {
                case "check":
                    let diff = await __GLOBAL.botUpdater.getDiff();
                    if (diff) {
                        updateLog.log(`There's a new version available! (you're behind by ${diff === Infinity ? "100+" : diff} version)`);
                    }
                case "auto":
                case "auto-restart":
                    if (diff) {
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
                case "none":
                    break;
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
})();
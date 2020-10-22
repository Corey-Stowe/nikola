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
})();
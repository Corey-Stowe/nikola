/**
 * Create a logger class in __GLOBAL
 * 
 * @param {object} __GLOBAL 
 */
module.exports = function (__GLOBAL) {
    let path = require("path");
    let fs = require("fs");
    let util = require("util");
    let os = require("os");

    const ANSI_CLEAR_LINE = "\x1B[2K";
    const ANSI_CARTIDGE_RETURN = "\x1B[0G";

    try {
        fs.mkdirSync(path.join(process.cwd(), ".data", "logs"), { recursive: true });
    } catch (_) { }

    if (__GLOBAL.getType(__GLOBAL.fileLogParams) !== "Object") {
        __GLOBAL.fileLogParams = {
            fileSplit: 0,
            date: 1,
            month: 1,
            year: 1970
        }
    }

    class Logger {
        prefix = "INTERNAL";
        isPlugin = false;

        log(...val) {
            // Get logging time
            let currentTime = new Date();
            // Format the current time. 
            let currentTimeHeader = currentTime.toISOString();

            // Get ANSI color header based on config
            let redColorValue = parseInt(process.env.CONSOLE_LOG_COLOR.substr(0, 2), 16);
            let greenColorValue = parseInt(process.env.CONSOLE_LOG_COLOR.substr(2, 2), 16);
            let blueColorValue = parseInt(process.env.CONSOLE_LOG_COLOR.substr(4, 2), 16);
            if (
                isNaN(redColorValue) ||
                isNaN(greenColorValue) ||
                isNaN(blueColorValue)
            ) {
                redColorValue = 0;
                greenColorValue = 255;
                blueColorValue = 0;
            }
            let ANSI_COLOR_HEADER = `\x1B[38;2;${redColorValue};${greenColorValue};${blueColorValue}m`;

            // Format values to string
            let colorFormat = "";
            let nonColorFormat = "";
            for (let value of val) {
                if (typeof value == "object") {
                    colorFormat += " " + util.formatWithOptions({
                        colors: true
                    }, "%O", value);
                    nonColorFormat += " " + util.formatWithOptions({
                        colors: false
                    }, "%O", value);
                } else {
                    colorFormat += " " + util.formatWithOptions({
                        colors: true
                    }, "%s", value);
                    nonColorFormat += " " + util.formatWithOptions({
                        colors: false
                    }, "%s", value);
                }
            }

            // Log to the console
            if (__GLOBAL.getType(console.original) !== "Object") {
                process.stdout.write(
                    ANSI_CLEAR_LINE +
                    ANSI_CARTIDGE_RETURN +
                    ANSI_COLOR_HEADER +
                    `[${currentTimeHeader}] ` +
                    (this.isPlugin ? "[PLUGIN] " : "") +
                    `[${this.prefix}]` +
                    colorFormat +
                    os.EOL
                );
            } else {
                console.original.log(
                    ANSI_CLEAR_LINE +
                    ANSI_CARTIDGE_RETURN +
                    ANSI_COLOR_HEADER +
                    `[${currentTimeHeader}]`,
                    (this.isPlugin ? "[PLUGIN] " : "") +
                    `[${this.prefix}]` +
                    colorFormat
                );
            }


            // Rewriting the REPL prompt (if any)
            if (__GLOBAL.replConsole) __GLOBAL.replConsole.prompt(false);

            // Log to a file
            __GLOBAL.ensureExists(path.join(process.cwd(), "logs")); // Ensure that ./logs directory exists.
            let searchFileSplit = false;
            if (__GLOBAL.fileLogParams.date !== currentTime.getUTCDate()) {
                __GLOBAL.fileLogParams.date = currentTime.getUTCDate();
                __GLOBAL.fileLogParams.fileSplit = 0;
                searchFileSplit = true;
            }
            if (__GLOBAL.fileLogParams.month !== currentTime.getUTCMonth() + 1) {
                __GLOBAL.fileLogParams.month = currentTime.getUTCMonth() + 1;
                __GLOBAL.fileLogParams.fileSplit = 0;
                searchFileSplit = true;
            }
            if (__GLOBAL.fileLogParams.year !== currentTime.getUTCFullYear()) {
                __GLOBAL.fileLogParams.year = currentTime.getUTCFullYear();
                __GLOBAL.fileLogParams.fileSplit = 0;
                searchFileSplit = true;
            }
            let logFilename = "logs-" +
                String(__GLOBAL.fileLogParams.date).padStart(2, "0") +
                "-" +
                String(__GLOBAL.fileLogParams.month).padStart(2, "0") +
                "-" +
                String(__GLOBAL.fileLogParams.year).padStart(4, "0") +
                "-" +
                __GLOBAL.fileLogParams.fileSplit +
                ".log";
            if (searchFileSplit) {
                for (; ;) {
                    logFilename = "logs-" +
                        String(__GLOBAL.fileLogParams.date).padStart(2, "0") +
                        "-" +
                        String(__GLOBAL.fileLogParams.month).padStart(2, "0") +
                        "-" +
                        String(__GLOBAL.fileLogParams.year).padStart(4, "0") +
                        "-" +
                        __GLOBAL.fileLogParams.fileSplit +
                        ".log";
                    if (!fs.existsSync(path.join(
                        process.cwd(),
                        ".data",
                        "logs",
                        logFilename
                    )) && !fs.existsSync(path.join(
                        process.cwd(),
                        ".data",
                        "logs",
                        "logs-" +
                        logFilename +
                        ".gz"
                    ))) break;
                    __GLOBAL.fileLogParams.fileSplit++;
                }
            }
            fs.appendFileSync(
                path.join(
                    process.cwd(),
                    ".data",
                    "logs",
                    logFilename
                ),
                `[${currentTimeHeader}] ` +
                (this.isPlugin ? "[PLUGIN] " : "") +
                `[${this.prefix}]` +
                nonColorFormat +
                os.EOL
            );
            // Future-proof. SSH logging.
            if (__GLOBAL.getType(__GLOBAL.sshTerminal) === "Object") {
                for (let ip in __GLOBAL.sshTerminal) {
                    // Get the SSH terminal instance to log. 
                    __GLOBAL.sshTerminal[ip].log.call(
                        __GLOBAL.sshTerminal[ip],
                        this.isPlugin,
                        currentTimeHeader,
                        this.prefix,
                        ...val
                    );
                }
            }
        }

        constructor(prefix = "INTERNAL", isPlugin = false) {
            this.prefix = String(prefix);
            this.isPlugin = Boolean(isPlugin);
            this.log = this.log.bind(this);
        }
    };

    return Logger;
}
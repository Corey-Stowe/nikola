let AdmZip = require("adm-zip");
let fs = require("fs");
let os = require("os");
let semver = require("semver");
let vm = require("vm");

module.exports = class FormatAParser {
    /**
     * @type {}
     */
    BotPlugin = (class BotPlugin { });
    logger;

    constructor() { };
    async setup(BotPlugin, Logger) {
        this.BotPlugin = BotPlugin;
        this.logger = new Logger("PluginFormatHandler:A");
        return this;
    }

    async check(url, extraData) {
        try {
            let parsedURL = new URL(url);
            let zipObj;
            switch (parsedURL.protocol) {
                case "file:":
                    // Read the files
                    let buffer;
                    if (os.platform() === "win32") {
                        buffer = await fs.promises.readFile(parsedURL.pathname.slice(1));
                    } else {
                        buffer = await fs.promises.readFile(parsedURL.pathname);
                    }

                    if (buffer.slice(0, 4).toString("ascii") === "\x50\x4b\x03\x04") {
                        // ZIP header detected. Start parsing to AdmZip class.
                        zipObj = new AdmZip(buffer);
                    } else if (buffer.slice(0, 16).toString("ascii") === "NIKOLA!?A!----") {
                        // Plugin-over-network (HTTP/PM) file placeholder detected.
                        this.logger.log("Type A/NP (plugin placeholder) is not supported yet. (WIP)");
                        return null;
                    } else return null;
                    break;
                case "http:":
                case "https:":
                    this.logger.log("Type A/W (plugin-over-HTTP) is not supported yet. (WIP)");
                    return null;
                case "pm+http:":
                case "pm+https:":
                case "pm:":
                    this.logger.log("Type A/P (plugin-over-PluginManager) is not supported yet. (WIP)");
                    return null;
                default:
                    return null;
            }

            let pluginInfo = zip.readAsText("plugins.json");
            let newRootDIR = "";
            if (global.getType(pluginInfo) !== "String" || !pluginInfo.length) {
                // Check if everything is contained inside a folder (GitHub always do this.)
                let zipEntries = zip.getEntries();
                newRootDIR = zipEntries.reduce((a, v) => {
                    let r = v.entryName.split("/")[0];
                    if (r.length === 0) return 9;
                    if (!a) return r;
                    if (a === r) return r;
                    return 9;
                }, null);
                if (newRootDIR === 9) return null;
                newRootDIR += "/";
                pluginInfo = zip.readAsText(`${newRootDIR}plugins.json`);
                if (global.getType(pluginInfo) !== "String") return null;
            }

            let pInfo = null;
            try {
                pInfo = JSON.parse(pluginInfo);
            } catch (_) {
                return null;
            }

            if (
                typeof pInfo.flag !== "string" ||
                typeof pInfo.name !== "string" ||
                typeof pInfo.version !== "string" ||
                typeof pInfo.exec !== "string"
            ) return null;
            
            {
                let splitedFlag = pInfo.flag.split("!");
                if (splitedFlag[0] !== "A" || splitedFlag[1] !== "1.0.0") return null;
            }

            if (!semver.parse(pInfo.version)) return null;

            let execCode = zipObj.readAsText(newRootDIR + pInfo.exec);
            if (!execCode) return null;

            // TODO: Running the code inside a VM, not letting it access the global scope.
            return null;
        } catch (_) { };
    }
}
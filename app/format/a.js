let AdmZip = require("adm-zip");
let fs = require("fs");
let os = require("os");

module.exports = class FormatAParser {
    /**
     * @type {}
     */
    BotPlugin = (class BotPlugin {});
    logger;

    constructor() {};
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

            // Got the AdmZip object in zipObj. 
            // TODO: Check if it's in valid format.
            return null;
        } catch (_) {};
    }
}
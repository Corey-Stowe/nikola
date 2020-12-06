let fs = require("fs");
let crypto = require("crypto");

module.exports = class InterfaceHandler {
    static validInterfaceType = ["discord"];
    interfaceResolver = {};

    __GLOBAL = {};
    logger;

    interfaceList = [];
    interfaceMapping = {};

    constructor(__GLOBAL) {
        this.__GLOBAL = __GLOBAL;
        this.logger = new __GLOBAL.Logger("InterfaceHandler");
    }

    async setup() {
        await this.#updateFromFile();
        for (let iType of InterfaceHandler.validInterfaceType) {
            this.interfaceResolver[iType] = await (require("./interface/" + iType))(this.__GLOBAL);
        }
    }

    #hookInterface = async (c) => {
        c.on("status", e => {
            // Calling event listener in plugins
            for (let p of this.__GLOBAL.plugins)
                if (typeof p.events.onInterfaceStatusChanged === "function") try {
                    p.events.onInterfaceStatusChanged(e);
                } catch (_) {
                    this.logger.error(`Could not pass InterfaceStatusChangeEvent to ${p.toString()} (is it up to date?):`, _);
                }
        });

        c.on("error", e => this.logger.error(`Interface ID ${c.id} encountered an error:`, e));

        c.on("message", async msg => {
            if (
                // Calling chathook event and check if something want to block internal command execution.
                !(await Promise.all(this.__GLOBAL.plugins.map(p => (
                    typeof p.events.chatHookEvent === "function" ?
                        p.events.chatHookEvent(msg) :
                        false
                )))).some(x => x === true)
            ) {
                if (msg.message.noResolve) return null;

                let currentPrefix = __GLOBAL.storage.get(
                    "CustomPrefix",
                    msg.rawClient.constructor.configServerLevel ?
                        msg.message.serverID :
                        msg.message.threadID
                ) || process.env.DEFAULT_PREFIX;

                if (msg.message.content.startsWith(currentPrefix) || msg.message.mentionPrefix) {
                    // Prep
                    let resolvedLang =
                        await this.__GLOBAL.storage.get("UserLanguage", msg.message.author) ||
                        await this.__GLOBAL.storage.get("ThreadLanguage", msg.message.threadID) ||
                        await this.__GLOBAL.storage.get("ServerLanguage", msg.message.serverID) ||
                        process.env.DEFAULT_USER_LANG;

                    let c = msg.message.content;
                    if (msg.message.mentionPrefix) c = c.replace(msg.message.mentionPrefix.mentionContent, "");

                    /** @type {string[]} */
                    let args = this.__GLOBAL.splitArgs(c);
                    if (!msg.message.mentionPrefix) args[0] = args[0].slice(currentPrefix.length);

                    if (!args.length) {
                        await msg.rawClient.sendMsg({
                            to: msg.message.threadID,
                            content: this.__GLOBAL.getLang(resolvedLang, "GET_PREFIX").objectReplace({
                                "{prefix}": currentPrefix
                            })
                        });
                        return null;
                    }

                    /** @type {{}} */
                    let cmdInfo = null;

                    if (args[0].indexOf(":") + 1) {
                        // Command called with namespaces/plugin scope.
                        let l = args[0].split(":");
                        let scope = l[0];

                        if (this.__GLOBAL.plugins[scope]) {
                            // Plugin is loaded.
                            let supported = this.__GLOBAL.plugins[scope].supportedCommand;
                            if (supported[l[1]]) {
                                cmdInfo = this.__GLOBAL.plugins[scope].commandInfo(supported[l[1]]);
                            }
                        } else {
                            // Plugin IS NOT LOADED.
                            if (!Boolean(process.env.SUPPRESS_UNKNOWN_CMD_MSG)) {
                                await msg.rawClient.sendMsg({
                                    to: msg.message.threadID,
                                    content: this.__GLOBAL.getLang(resolvedLang, "UNKNOWN_COMMAND").objectReplace({
                                        "{prefix}": currentPrefix
                                    })
                                });
                                return null;
                            }
                        }
                    } else {
                        // Find the command in every plugins (default command also count as a single plugin)
                        for (let s in this.__GLOBAL.plugins) {
                            let p = this.__GLOBAL.plugins[s];

                            if (p.supportedCommand[args[0]]) {
                                cmdInfo = p.commandInfo(p.supportedCommand[args[0]]);
                                // There should be a "break;" here, but I don't put it here so as to let other plugins take that command if wanted.
                            }
                        }

                        if (!cmdInfo) {
                            if (!Boolean(process.env.SUPPRESS_UNKNOWN_CMD_MSG)) {
                                await msg.rawClient.sendMsg({
                                    to: msg.message.threadID,
                                    content: this.__GLOBAL.getLang(resolvedLang, "UNKNOWN_COMMAND").objectReplace({
                                        "{prefix}": currentPrefix
                                    })
                                });
                                return null;
                            }
                        }
                    }

                    // Now executing the command.
                    try {
                        let d = await cmdInfo.exec(msg);
                        // TODO: implement custom handler + chaining
                    } catch (e) {
                        await msg.rawClient.sendMsg({
                            to: msg.message.threadID,
                            content: this.__GLOBAL.getLang(resolvedLang, "AN_ERROR_OCCURED").objectReplace({
                                "{error}": e.stack
                            })
                        });
                    }
                }
            }
        });
    }

    #createInterface = async (iData) => {
        if (InterfaceHandler.validInterfaceType.indexOf(iData.type) + 1) {
            // Interface type is valid.
            let id = iData.id;
            if (typeof id !== "number" || isNaN(id) || id < 0 || id % 1 !== 0) {
                id = crypto.randomBytes(2).readUInt16LE();
                this.logger.log(`Warning: Interface doesn't specify ID. This could result in an error and causing plugin malfunction.`);
            }

            // Silently changing ID if duplicates found.
            for (; ;) {
                if (this.interfaceMapping[id]) {
                    id = crypto.randomBytes(2).readUInt16LE();
                } else break;
            }

            // Creating class
            let c = new this.interfaceResolver[iData.type](id);;
            try {
                await c.login(iData.accountInfo);
            } catch (_) {
                this.logger.log(`Error: Interface ID ${id} failed to login:`, _);
            }

            // Hook to class
            await this.#hookInterface(c);

            let ilID = this.interfaceList.push(c) - 1;
            this.interfaceMapping[id] = ilID;
        } else {
            this.logger.log(`Warning: Couldn't understand interface "${iData.type}". Please open accountData file and remove invalid interface.`);
        }
    }

    #updateFromFile = async () => {
        let accountDataPath = path.join(process.cwd(), process.env.ACCOUNT_DATA_PATH);
        let accountData = [];
        if (fs.existsSync(accountData)) {
            accountData = JSON.parse(await fs.promises.readFile(accountDataPath, { encoding: "utf8" }));
        } else {
            await fs.promises.writeFile(accountDataPath, "[]");
        }

        await this.#clearState();
        await Promise.all(accountData.map(x => this.#createInterface(x)));
    }

    #clearState = async () => {
        await Promise.all(this.interfaceList.map(x => x.destroy()));
        this.interfaceList = [];
        this.interfaceMapping = {};
    }
}

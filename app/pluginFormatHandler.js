let path = require("path");
let semver = require("semver");

const BotPlugin = class BotPlugin {
    #dataObj = {
        name: "",
        version: new semver.SemVer("0.0.0"),
        author: "",
        scopeName: "",
        commandSet: {
            "null": {
                exec: () => { return { handler: "default", data: { content: "" } }},
                compatibly: ["platform"],
                helpArgs: { "ISO": "" },
                helpDesc: { "ISO": "" },
                example: ["$@$null"], // $@$ is the current prefix
                defaultViewPerm: true,
                defaultExecPerm: true
            }
        }
    };
    get name() { return this.#dataObj.name }
    get version() { return this.#dataObj.version }
    get author() { return this.#dataObj.author || "" }

    #scope = {};
    get scope() { return this.#scope }

    constructor(objectData) {
        if (typeof objectData.pluginType !== "string") throw new Error("objectData MUST HAVE `pluginType` set to plugin type name! [string]");
        if (typeof objectData.name !== "string") throw new Error("objectData MUST HAVE `name` set to plugin name! [string]");
        if (typeof objectData.scopeName !== "string") throw new Error("objectData MUST HAVE `scopeName` set to plugin scope name! [string]");
        if (typeof objectData.version !== "string" || !semver.parse(objectData.version)) throw new Error("objectData MUST HAVE `version` set to version following the Semantic Versioning (x.y.z)! [string]");

        this.#dataObj.commandSet = {
            name: objectData.name,
            scopeName: objectData.scopeName,
            version: semver.parse(objectData.version),
            author: objectData.author || "",
            commandSet: {}
        }
        this.#scope = objectData.scope;
        
        if (typeof objectData.scope === "object" && typeof objectData.commandDef === "object") {
            for (let cmd in objectData.commandDef) {
                if (typeof objectData.commandDef[cmd].exec !== "function") continue;
                if (typeof objectData.commandDef[cmd].compatibly === "string") objectData.commandDef[cmd].compatibly = [
                    objectData.commandDef[cmd].compatibly
                ];
                if (global.getType(objectData.commandDef[cmd]) !== "Array") continue;

                if (typeof objectData.commandDef[cmd].helpArgs === "string") {
                    objectData.commandDef[cmd].helpArgs = {
                        "*": objectData.commandDef[cmd].helpArgs
                    }
                }
                if (global.getType(objectData.commandDef[cmd].helpArgs) !== "Object") {
                    objectData.commandDef[cmd].helpArgs = { "*": "" };
                }

                if (typeof objectData.commandDef[cmd].helpDesc === "string") {
                    objectData.commandDef[cmd].helpDesc = {
                        "*": objectData.commandDef[cmd].helpDesc
                    }
                }
                if (global.getType(objectData.commandDef[cmd].helpDesc) !== "Object") {
                    objectData.commandDef[cmd].helpDesc = { "*": "" };
                }

                if (typeof objectData.commandDef[cmd].example === "string") {
                    objectData.commandDef[cmd].example = [
                        objectData.commandDef[cmd].example
                    ]
                }
                if (global.getType(objectData.commandDef[cmd].example) !== "Array") {
                    objectData.commandDef[cmd].example = [];
                }

                objectData.commandDef[cmd].defaultViewPerm = Boolean(
                    objectData.commandDef[cmd].defaultViewPerm
                );

                objectData.commandDef[cmd].defaultExecPerm = Boolean(
                    objectData.commandDef[cmd].defaultExecPerm
                );

                this.#dataObj.commandSet[cmd] = {
                    exec: objectData.commandDef[cmd].exec,
                    compatibly: objectData.commandDef[cmd].compatibly,
                    helpArgs: objectData.commandDef[cmd].helpArgs,
                    helpDesc: objectData.commandDef[cmd].helpDesc,
                    example: objectData.commandDef[cmd].example,
                    defaultViewPerm: objectData.commandDef[cmd].defaultViewPerm,
                    defaultExecPerm: objectData.commandDef[cmd].defaultExecPerm
                }
            }
        }
    }
}

module.exports = class FormatHandler {
    __GLOBAL = {};
    #formatList = ["A"];
    #formatResolver = [];

    constructor(__GLOBAL) {
        this.__GLOBAL = __GLOBAL;
    }

    async setup() {
        this.#formatResolver = await Promise.all(
            this.#formatList.map(fName => {
                let Resolver = require(path.join(process.cwd(), "app", "format", fName.toLowerCase()));
                return (new Resolver()).setup(BotPlugin, __GLOBAL.Logger);
            })
        );
        return this;
    }

    async checkType(url, extraData) {
        let result = await Promise.all(this.#formatResolver.map(f => f.check(url, extraData)));
        result = result.filter(x => x != null);
        if (result.length === 0) return false;
        return result[0];
        // { type: "A/*", resolver: [AsyncFunction Resolver] }
    }

    async load(url, extraData) {
        let check = await this.checkType(url, extraData);
        if (check) {
            return this.loadFromClass(await check.resolver());
        } else throw new Error("Invalid or unsupported format.");
    }

    async loadFromClass(cl) {
        if (cl instanceof BotPlugin) {
            // TODO: Resolve this.
        } else throw new Error("Invalid class, it should be typeof BotPlugin.");
    }
}
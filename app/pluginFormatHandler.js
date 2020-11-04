let path = require("path");

const BotPlugin = class BotPlugin {}

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
                return (new Resolver()).setup();
            })
        );
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
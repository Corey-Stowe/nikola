module.exports = class FormatAParser {
    BotPlugin = (class BotPlugin {})

    constructor() {};
    async setup(BotPlugin) {
        this.BotPlugin = BotPlugin;
        return this;
    }

    async check(url, extraData) {}
}
module.exports = async function getClass(__GLOBAL) {
    let Discord = require("discord.js");
    const { EventEmitter } = require("events");

    return class DiscordInterface extends EventEmitter {
        static fields = {
            token: "string"
        }
        static parser(input) {
            return { token: input }
        }
        static getDiscordJS = () => Discord;
        static statusMessage = {
            [-Infinity]: "Not initialized",
            [-1]: "Unexpected error occured",
            0: "Ready",
            1: "Listening"
        }

        static configServerLevel = true;

        static interfaceType = "Discord";

        #status = -Infinity;
        #djsInstance = new Discord.Client();
        #id = 0;
        #accountID = "";
        #accountName = "";
        get accountID() { return this.#accountID; }
        get accountName() { return this.#accountName; }
        get id() { return this.#id; }
        get status() { return this.#status; }
        get instance() { return this.#djsInstance; }

        _updateStatus(statusCode = 0) {
            if (Object.values(this).indexOf(this._updateStatus.caller) + 1) {
                // Called from this class. Safe to change.
                let oldCode = this.#status;
                this.#status = statusCode;
                this.emit("status", {
                    from: oldCode,
                    to: this.#status,
                    class: this
                });
            } else throw new Error("This function can only be called inside DiscordInterface class.");
        }

        constructor(id = 0) {
            this.#id = id;
        }
        async login(accInfo) {
            if (this.#status !== -Infinity) throw new Error("Cannot initailize an interface more than once.");

            this.#djsInstance = new Discord.Client();
            await this.#djsInstance.login(accInfo.token);
            this._updateStatus(0);
            this.#djsInstance.on("ready", () => {
                this._updateStatus(1);
                this.#accountID = this.#djsInstance.user.id;
                this.#accountName = this.#djsInstance.user.tag;
            });
            this.#djsInstance.on("message", msg => {
                let that = this;
                with ({ ...msg, that }) {
                    that.emit("message", {
                        id: that.#id,
                        rawClient: that,
                        rawMessage: msg,
                        message: {
                            content,
                            mentions,
                            attachments,
                            senderID: `Discord$.$User$.$${author.id}`,
                            messageID: `Discord$.$Message$.$${msg.id}`,
                            isBot: author.bot,
                            noResolve: author.bot || system,
                            threadID: `Discord$.$${channel.type === "dm" ? "DMChannel" : "Channel"}$.$${channel.id}`,
                            serverID: channel.type == "dm" ?
                                `Discord$.$DMChannel$.$${channel.id}` :
                                `Discord$.$Server$.$${guild.id}`,
                            isDM: channel.type === "dm",
                            mentionPrefix: content.trim().indexOf(`<@${that.accountID}>`) === 0 ?
                                {
                                    from: content.indexOf(`<@${that.accountID}>`),
                                    to: content.indexOf(`<@${that.accountID}>`) + `<@${that.accountID}>`.length,
                                    mentionContent: `<@${that.accountID}>`
                                } :
                                false
                        }
                    });
                }
            });
            this.#djsInstance.on("error", err => {
                this.emit("error", { causedBy: "discord.js", error: err });
                this._updateStatus(-1);
            });

            return this;
        }

        async sendMsg(d) {
            if (d.to && d.content) {
                let s = d.to.split("$.$");

                if (s[0] !== "Discord") return false;
                switch (s[1]) {
                    case "DMChannel":
                    case "Channel":
                        // Channel ID is on s[2]
                        return await (await this.#djsInstance.channels.fetch(s[2])).send(d.content, d.extraData);
                    default:
                        return false;
                }
            } else return false;
        }

        async destroy() {
            this.#djsInstance.destroy();
            this._updateStatus(-Infinity);
        }
    }
}
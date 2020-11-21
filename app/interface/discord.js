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
                this.#status = statusCode;
                this.emit("status", this.#status);
            } else throw new Error("This function can only be called inside DiscordInterface class.");
        }

        constructor(id = 0) {
            this.#id = id;
        }
        async login(accInfo) {
            this.#djsInstance = new Discord.Client();
            await this.#djsInstance.login(accInfo.token);
            this._updateStatus(0);
            this.#djsInstance.on("ready", () => {
                this._updateStatus(1);
                this.#accountID = this.#djsInstance.user.id;
                this.#accountName = this.#djsInstance.user.tag;
            });
            this.#djsInstance.on("message", msg => {
                this.emit("message", {
                    id: this.#id,
                    rawClient: this,
                    rawMessage: msg,
                    message: {
                        content: msg.content,
                        mentions: msg.mentions,
                        attachments: msg.attachments,
                        senderID: `Discord$.$User$.$${msg.author.id}`,
                        messageID: `Discord$.$Message$.$${msg.id}`,
                        isBot: msg.author.bot,
                        noResolve: msg.author.bot || msg.system,
                        threadID: `Discord$.$${msg.channel.type === "dm" ? "DMChannel" : "Channel"}$.$${msg.channel.id}`,
                        serverID: msg.channel.type == "dm" ?
                            `Discord$.$DMChannel$.$${msg.channel.id}` :
                            `Discord$.$Server$.$${msg.guild.id}`,
                        isDM: msg.channel.type === "dm"
                    }
                });
            });
            this.#djsInstance.on("error", err => {
                this.emit("error", { causedBy: "discord.js", error: err });
                this._updateStatus(-1);
            });
        }
        async destroy() {
            this.#djsInstance.destroy();
            this._updateStatus(-Infinity);
        }
    }
}
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

        c.on("message", msg => {
            
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
            for (;;) {
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

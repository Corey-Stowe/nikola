let path = require("path");
let fs = require("fs");

module.exports = async (StorageBase) => {
    return class JSONStorage extends StorageBase {
        #storage = {};
        #endpoint = "";
        #tempEndpoint = "";

        constructor() {
            super(false);
        }

        async config() {
            this.#endpoint = path.join(process.cwd(), String(process.env.JSON_STORAGE_PATH));
            this.#tempEndpoint = path.join(process.cwd(), String(process.env.JSON_TEMP_STORAGE_PATH));
            return this;
        }

        #save = async () => {
            if (!this.busy) {
                this.busy = true;
                await fs.promises.writeFile(this.#tempEndpoint, JSON.stringify(this.#storage, null, "\t"));
                await fs.promises.rename(this.#tempEndpoint, this.#endpoint);
                this.busy = false;
            }
        }

        #reload = async () => {
            if (!this.busy) {
                this.busy = true;
                let initData = await fs.promises.readFile(this.#endpoint);
                try {
                    let data = JSON.parse(initData);
                    this.#storage = data;
                } catch (_) {
                    if (!fs.existsSync(this.#endpoint)) fs.writeFileSync(this.#endpoint, "{}");
                    this.#storage = {};
                }
                this.busy = false;
            }
        }

        async get(table = "default", key) {
            if (global.getType(this.#storage[table]) !== "Object") {
                this.#storage[table] = {};
                await this.#save();
            }
    
            return this.#storage[table][key];
        }
    
        async set(table = "default", key, value) {
            if (global.getType(this.#storage[table]) !== "Object") {
                this.#storage[table] = {};
            }
    
            this.#storage[table][key] = value;
            await this.#save();
        }
    
        async delete(table = "default", key) {
            if (global.getType(this.#storage[table]) !== "Object") {
                this.#storage[table] = {};
            }
    
            let status = delete this.#storage[table][key];
            await this.#save();
            return status;
        }
    
        async deleteTable(table = "default") {
            await this.#reload();
            if (global.getType(this.#storage[table]) !== "Object") {
                return true;
            }
    
            let status = delete this.#storage[table];
            await this.#save();
            return status;
        }

        async setTable(object, table = "default") {
            if (global.getType(object) !== "Object") throw "Only object are allowed.";

            this.#storage[table] = object;
            await this.#save();
        }
    
        async getTable(table = "default") {
            await this.#reload();
            if (global.getType(this.#storage[table]) !== "Object") {
                this.#storage[table] = {};
                await this.#save();
            }
    
            return this.#storage[table];
        }
    }
}

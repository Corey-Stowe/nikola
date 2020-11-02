let path = require("path");

class StorageBase {
    #isNil = true;
    get isNil() {
        return this.#isNil;
    }

    constructor(isNil) {
        this.#isNil = Boolean(isNil);
    }

    /**
     * Get a value inside a table.
     * 
     * @param {string} key Key
     * @param {string} table Table name
     * 
     * @returns {Promise<any>} Value
     */
    async get(key, table = "default") { };

    /**
     * Set a value to a key inside a table.
     * 
     * @param {string} key Key
     * @param {*} value Value
     * @param {string} table Table name
     * 
     * @returns {Promise<void>} Nothing
     */
    async set(key, value, table = "default") { };

    /**
     * Delete a key inside a table.
     * 
     * @param {string} key Key
     * @param {string} table Table name
     * 
     * @returns {Promise<boolean>} Status whether key is deleted or not.
     */
    async delete(key, table = "default") { };

    /**
     * Get all the contents inside a table.
     * 
     * @param {string} table Table name
     * 
     * @returns {object} Table contents
     */
    async getTable(table = "default") { };

    /**
     * Set contents inside a table.
     * 
     * @param {object} object Object with key-value
     * @param {string} table Table name
     * 
     * @returns {Promise<void>} Nothing
     */
    async setTable(object, table = "default") { };

    /**
     * Delete a table.
     * 
     * @param {string} table Table name
     * 
     * @returns {Promise<boolean>} Status whether table is deleted or not.
     */
    async deleteTable(table = "default") { };

    /**
     * Get a list of table name.
     * 
     * @returns {Promise<Array>} Array containing table names.
     */
    async getTableList() { };
}
global.StorageBase = StorageBase;

module.exports = class GetStorage {
    static validStorageType = ["json"];
    storage = new StorageBase();

    async getStorage() {
        if (GetStorage.validStorageType.indexOf(String(process.env.STORAGE_TYPE).toLowerCase()) + 1) {
            if (this.storage.isNil) {
                let Storage = require(path.join(process.cwd(), "app", "storage", process.env.STORAGE_TYPE))(StorageBase);
                this.storage = new Storage(process.env);
                this.storage = await this.storage.config();
                return this.storage;
            } else return this.storage;
        } else throw new Error("Invalid storage type.");
    }
}

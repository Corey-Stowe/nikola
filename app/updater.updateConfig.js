let fs = require("fs");
let path = require("path");
let os = require("os");

const replaceTable = [{}];

module.exports = async function updateConfig() {
    // Get .env.default file
    let defaultENV = await fs.promises.readFile(path.join(process.cwd(), ".env.default"), { encoding: "utf8" });
    let splitedDefENV = defaultENV.split(/\r?\n/);
    let updatedDefENV = splitedDefENV.map(v => {
        if (v.startsWith("#")) return v;
        if (!(v.indexOf("=") + 1)) return v;
        let splitedKeyValue = v.split("=", 2);
        
        let newValue = process.env[splitedKeyValue[0]] || splitedKeyValue[1];

        let repTable = replaceTable[parseInt(process.env.CONFIG_VERSION)][splitedKeyValue[0]];
        if (repTable && repTable[newValue]) {
            newValue = repTable[newValue];
        }

        return splitedKeyValue[0] + "=" + newValue;
    });

    let newENV = updatedDefENV.join(os.EOL);
    
    try {
        await fs.promises.writeFile(path.join(process.cwd(), ".env"), newENV, { encoding: "utf8" });
    } catch (ex) {
        return false;
    }
    return true;
}

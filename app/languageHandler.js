let fs = require("fs");
let path = require("path");
let cache = [];

module.exports = function getLang(lang, key) {
    if (global.getType(cache[lang]) !== "Object") {
        try {
            cache[lang] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "app", "lang", lang + ".json"), { encoding: "utf8" }));
        } catch (_) {
            return String((cache["en_US"] || {})[key]);
        }
    }

    return String(cache[lang][key]);
}
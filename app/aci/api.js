module.exports = async function getAPI(__GLOBAL) {
    let express = require("express");
    let path = require("path");
    let fs = require("fs");

    let possibleVersion = ["v0"];

    return await Promise.all(possibleVersion.map(async function (version) {
        let router = express.Router();
        let apiList = await fs.promises.readdir(path.join(__dirname, version), { withFileTypes: true, encoding: "utf8" });
        apiList = apiList
            .filter(x => x.isFile() && /^.*\.js$/.test(path.parse(x.name).base))
            .map(y => path.parse(y.name).name);

        for (let api of apiList) {
            router.all(`/${api}/*`, require(path.join(__dirname, version, api))(__GLOBAL));
        }
        router.use(function (req, res) {
            return res.status(404).json({ error: "API not found. Please take a look at API documentation on https://github.com/Project-Dec1mus/nikola/blob/master/ACI-API-DOCS.md" })
        });
        return router;
    }));
}

const api = require("./api");

module.exports = async function (__GLOBAL) {
    let express = require("express");
    let app = express();

    // API section
    let api = await (require("./api")(__GLOBAL));
    api.forEach((r, i) => app.use(`/api/v${i}`, r));

    app.use("/api", api[api.length - 1]);

    // Listen to the web
    app.listen(+process.env.ACI_WWW_LISTEN_PORT, process.env.ACI_WWW_LISTEN_ADDRESS);
}
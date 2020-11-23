module.exports = async function getFunc(__GLOBAL) {
    let crypto = require("crypto");

    return function auth(req, res) {
        if (req.method !== "POST") return res.status(400).json({ error: "POST is required to use this endpoint."});
        if (!req.query.programName || req.query.programName.trim() === "") return res.status(400).json({ error: "programName is required to get a token."});

        if (req.query.password === process.env.ACI_PASSWORD && process.env.ACI_PASSWORD.trim() !== "") {
            // Authenticated. Generating a new token that is 16 bytes (32 characters) long (expires in 1h).
            let randomToken = crypto.randomBytes(16).toString("hex");
            
            // And put it in the storage.
            let currentStorage = await __GLOBAL.storage.get("ACI", "auth");
            let expires = Date.now() + 3600000;
            currentStorage[randomToken] = {
                programName: req.query.programName,
                expires
            }
            await __GLOBAL.storage.set("ACI", "auth", currentStorage);

            res.status(200).json({ token: randomToken, expires });
        } else {
            res.status(400).json({ error: "Invalid password." });
        }
    }
}

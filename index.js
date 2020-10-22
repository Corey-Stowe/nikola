/* 
    Copyright (C) 2020  BadAimWeeb/TeamDec1mus

    Just call this a bootloader.
*/
(async () => {
    var semver = require("semver");
    var nodeVersion = semver.parse(process.version);
    if (nodeVersion.major < 12 || (nodeVersion.major == 12 && nodeVersion.minor < 9)) {
        console.error("ERROR: Node.js 12+ (>=12.9) is required to run this! (current: " + process.version + ")");
        process.exit(1);
    }

    var childProcess = require("child_process");
    var fs = require("fs");
    var path = require("path");

    function spawn(cmd, arg) {
        return new Promise(resolve => {
            var npmProcess = childProcess.spawn(cmd, arg, {
                shell: true,
                stdio: "inherit",
                cwd: __dirname
            });
            npmProcess.on("close", function (code) {
                resolve(code);
            });
        });
    }

    async function loader(message = "") {
        if (message !== "") {
            console.log();
            console.log("[Loader] " + message);
        }
        if (fs.existsSync(path.join(__dirname, ".data", "flag_upgrade"))) {
            await (spawn("npm", ["--production", "install"])
                .then(() => spawn("npm", ["--depth", "9999", "update"]))
                .then(() => {
                    fs.unlinkSync(path.join(__dirname, ".data", "flag_upgrade"));
                })
                .catch(() => { }));
        }
        var child = childProcess.spawn("node", ["--experimental-repl-await", "--trace-warnings", "main.js"], {
            cwd: __dirname,
            maxBuffer: 16384 * 1024,
            stdio: "inherit",
            shell: true
        });
        child.on("close", async (code) => {
            if (code % 256 === 102) {
                await loader("Restarting");
                return;
            }

            if (code % 256 === 134) {
                await loader("Known bug detected (error 134, 'Assertion `num == numcpus` failed.'). Restarting...");
                return;
            }

            console.log();
            console.log(`[Loader] Error code ${code}. Stopping...`);
            process.exit();
        });
        child.on("error", function (err) {
            console.log();
            console.log("[Loader] Error:", err);
        });
    }
    await loader();
})();
let events = require("events");
let childProcess = require("child_process");
var concat = require('concat-stream');
let stream = require("stream");
let path = require("path");
let fs = require("fs");
let semver = require("semver");
let fetch = require("node-fetch");

/**
 * Promisify the readable stream.
 * 
 * @param {stream.Readable} stream 
 */
function concatStream(stream) {
    return new Promise(r => {
        stream.pipe(concat(r), { end: true });
    });
}

function spawn(cmd, arg) {
    return new Promise(resolve => {
        var npmProcess = childProcess.spawn(cmd, arg, {
            shell: true,
            stdio: "pipe",
            cwd: process.cwd()
        });
        npmProcess.on("close", function (code) {
            resolve([code, await concatStream(npmprocess.stdout)]);
        });
    });
}

module.exports = class Updater extends events.EventEmitter {
    /** 
     * @type {function}
     */
    #logFunc;

    constructor(logFunc) {
        super({
            captureRejections: true
        });

        this.#logFunc = logFunc;
    }

    /**
     * Get the version difference (how many version this system is behind.)
     * 
     * @returns {number} n version behind.
     */
    async getDiff() {
        let gitCheck = await spawn("git", ["rev-parse", "--is-inside-work-tree"]);
        var isGit = (!gitCheck[0] ? gitCheck[1].toString("utf8").split(/(\r\n)|(\r)|(\n)/g)[0] == "true" : false);

        if (isGit) {
            if ((await spawn("git", ["fetch"]))[0]) return 0;
            return +((await spawn("git", ["rev-list", "--count", "HEAD...refs/remotes/origin/HEAD"]))[0]);
        } else {
            // TODO: Use GitHub API to check for diff in releases.
            /** @type {string} */
            let currVersion = JSON.parse(
                await fs.promises.readFile(path.join(process.cwd(), "package.json"), { encoding: "utf8" })
            ).version;
            let so = semver.parse(currVersion);
            
            if (so.prerelease[0].toLowerCase() === "alpha" || so.prerelease[0].toLowerCase() === "beta") {
                // Indev version detected. Stop update and raise warning.
                this.#logFunc("Detected beta version not installed by git cloning. This is not recommended, as we can't auto-update (can't know what commit you are on).");
                this.#logFunc("In the future, you will be updated to stable version if git tree is not detected.");
                return 0;
            }
            
            // Now try to check for update using GitHub API.
            try {
                let pURL = new URL(process.env.UPDATER_REPOSITORY);
                let pathSplit = pURL.pathname.split("/");
                if (
                    (pURL.protocol !== "http:" && pURL.protocol !== "https:") ||
                    pURL.hostname.toLowerCase() !== "github.com" ||
                    pathSplit.length <= 2
                ) {
                    this.#logFunc(`Invalid value "${process.env.UPDATER_REPOSITORY}" in config. (not a valid GitHub repository URL) (config key: UPDATER_REPOSITORY)`);
                    return 0;
                }

                let gr = await fetch(`https://api.github.com/repos/${pathSplit[1]}/${pathSplit[2]}/releases?per_page=100`, {
                    headers: {
                        "User-Agent": `NikolaBot/${currVersion} node-fetch/1.0`,
                        "Accept": "application/vnd.github.v3.full+json"
                    }
                });

                switch (gr.status) {
                    case 200:
                        // Repository found.
                        /** @type {Array<>} */
                        let j = await gr.json();

                        // Array: From latest to earliest version
                        let v = j.map(v => v["tag_name"]);

                        let versionPos = v.indexOf(currVersion);
                        if (versionPos + 1) {
                            return versionPos;
                        } else return Infinity;
                    case 403:
                        // Rate-limited or private repository
                        this.#logFunc(`Error: API Rate-limited or private repository (config key: UPDATER_REPOSITORY)`);
                        return 0;
                    case 404:
                        this.#logFunc(`Invalid value "${process.env.UPDATER_REPOSITORY}" in config. (repository not found) (config key: UPDATER_REPOSITORY)`);
                        return 0;
                    default:
                        this.#logFunc(`Unknown error returned from GitHub API (${gr.status}).`);
                        return 0;
                }
            } catch (_) {
                this.#logFunc(`Invalid value "${process.env.UPDATER_REPOSITORY}" in config. (config key: UPDATER_REPOSITORY)`);
                return 0;
            }
        }
    }

    async performUpdate() {
        this.#logFunc("Update logic isn't implented yet.");
        return false;
    }
};

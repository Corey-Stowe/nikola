let events = require("events");
let childProcess = require("child_process");
var concat = require('concat-stream');
let stream = require("stream");
let path = require("path");
let fs = require("fs");
let semver = require("semver");
let fetch = require("node-fetch");
let AdmZip = require("adm-zip");

/**
 * Promisify the readable stream.
 * 
 * @param {stream.Readable} stream 
 */
let concatStream = function concatStream(stream) {
    return new Promise(r => {
        stream.pipe(concat(r), { end: true });
    });
}

const isDirectory = async (source) => (await fs.promises.lstat(source)).isDirectory();
const getDirectories = async (source) =>
    (await fs.promises.readdir(source)).map(name => path.join(source, name)).filter(isDirectory);

let spawn = function spawn(cmd, arg, stdio = "pipe") {
    return new Promise(resolve => {
        var npmProcess = childProcess.spawn(cmd, arg, {
            shell: true,
            stdio,
            cwd: process.cwd()
        });
        let data = concatStream(npmProcess.stdout);
        npmProcess.on("close", async function (code) {
            resolve([code, await data]);
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
            return +((await spawn("git", ["rev-list", "--count", "HEAD...refs/remotes/origin/HEAD"]))[1].toString());
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
                        if (v.length === 0) return 0;
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
        let gitCheck = await spawn("git", ["rev-parse", "--is-inside-work-tree"]);
        var isGit = (!gitCheck[0] ? gitCheck[1].toString("utf8").split(/(\r\n)|(\r)|(\n)/g)[0] == "true" : false);

        if (isGit) {
            // Use git to get updates
            try {
                let pull1 = await spawn("git", ["pull"]);
                if (pull1[0] === 0) throw true;
                await spawn("git", ["reset", "--hard"]);
                let pull2 = await spawn("git", ["pull"]);
                if (pull2[0] === 0) throw true;
                let currECode = pull2[0];
                if (pull2[0] === 128) {
                    await spawn("git", ["config", "user.name", "NikolaUpdater"]);
                    await spawn("git", ["config", "user.email", "autoupdate@nikola.bot"]);
                    let pull3 = await spawn("git", ["pull"]);
                    currECode = pull3[0];
                }
                if (currECode === 0) throw true;
                await spawn("git", ["fetch", "origin", "master"]);
                let reset = await spawn("git", ["reset", "--hard", "origin/master"]);
                if (reset[0] !== 0) {
                    this.#logFunc(`ERROR: Cannot restore HEAD to latest. (Error code ${reset[0]})`);
                    throw false;
                }
                throw true;
            } catch (e) {
                if (e === true) {
                    await fs.promises.writeFile(path.join(process.cwd(), ".data", "flag_upgrade"), "");
                    let updateConfig = require("./updater.updateConfig");
                    if (await updateConfig()) {
                        return true;
                    }
                    this.#logFunc("ERROR: Cannot update config to latest version. Please copy .env.default file to .env and change your config.");
                    return false;
                } else {
                    return false;
                }
            }

        } else {
            // Use fetch to get updates from GitHub
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
                    let v = await gr.json();
                    if (v.length === 0) {
                        this.#logFunc(`Error: No releases found in repository. Cannot update.`);
                        return false;
                    }
                    let latestV = v[0].zipball_url;

                    // Download update
                    let zip = await (await fetch(latestV)).buffer();
                    let zipObject = new AdmZip(zip);

                    // Extract to a temp folder somewhere in .data
                    try { await fs.promises.rmdir(path.join(process.cwd(), ".data", "updater_files"), { recursive: true }) } catch (_) { }
                    try { await fs.promises.mkdir(path.join(process.cwd(), ".data", "updater_files"), { recursive: true }) } catch (_) { }
                    zipObject.extractAllTo(path.join(process.cwd(), ".data", "updater_files"));

                    // Get folder
                    let folderList = await getDirectories(path.join(process.cwd(), ".data", "updater_files"));
                    let fileList = global.findFromDir(folderList[0], /.*/, true, true);
                    for (var i in fileList) {
                        var fileObj = path.parse(fileList[i]);
                        global.ensureExists(fileObj.dir, 0o777);

                        let newDir = path.resolve(process.cwd(), path.relative(folderList[0], fileList[i]));
                        try {
                            await fs.promises.rename(fileList[i], newDir);
                        } catch (ex) {
                            //Cannot rename, using write to new files and unlink old files method
                            await fs.promises.writeFile(newDir, await fs.promises.readFile(fileList[i]));
                            await fs.promises.unlink(fileList[i]);
                        }
                    }

                    await fs.promises.writeFile(path.join(process.cwd(), ".data", "flag_upgrade"), "");
                    let updateConfig = require("./updater.updateConfig");
                    if (await updateConfig()) {
                        return true;
                    }
                    this.#logFunc("ERROR: Cannot update config to latest version. Please copy .env.default file to .env and change your config.");
                    return false;
                case 403:
                    // Rate-limited or private repository
                    this.#logFunc(`Error: API Rate-limited or private repository (config key: UPDATER_REPOSITORY)`);
                    return false;
                case 404:
                    this.#logFunc(`Invalid value "${process.env.UPDATER_REPOSITORY}" in config. (repository not found) (config key: UPDATER_REPOSITORY)`);
                    return false;
                default:
                    this.#logFunc(`Unknown error returned from GitHub API (${gr.status}).`);
                    return false;
            }
        }
    }
};

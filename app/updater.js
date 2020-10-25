let events = require("events");
let childProcess = require("child_process");
var concat = require('concat-stream');
let util = require("util");
let stream = require("stream");

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
    constructor() {
        super({
            captureRejections: true
        });
    }

    async getDiff() {
        // TODO: Rewrite this to use async.
        let gitCheck = childProcess.spawn("git", [
            "rev-parse",
            "--is-inside-work-tree"
        ], {
            shell: true,
            stdio: "pipe",
            cwd: process.cwd()
        });
        var isGit = (!gitCheck.error ? gitCheck.stdout.toString("utf8").split(/(\r\n)|(\r)|(\n)/g)[0] == "true" : false);

        if (isGit) {
            if ((await spawn("git", ["fetch"]))[0]) return 0;
            return +((await spawn("git", ["rev-list", "--count", "HEAD...refs/remotes/origin/HEAD"]))[0]);
        } else {
            // TODO: Use GitHub API to check for diff in releases.
            return 0;
        }
    }

    async performUpdate() {
        throw new Error("Update logic isn't implented yet.");
    }
}
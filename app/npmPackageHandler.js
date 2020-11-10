const emptyPKGJSON = `{
    "name": "nikola-plugin-npm",
    "version": "1.0.0",
    "description": "",
    "main": "index.js",
    "scripts": {
        "test": "exit 0"
    },
    "author": "",
    "license": "GPL-3.0"
}`;

module.exports = async (__GLOBAL) => {
    let fs = require("fs");
    let path = require("path");
    let semver = require("semver");
    let childProcess = require("child_process");
    let logger = new __GLOBAL.Logger("NPMPackageHandler");
    let log = logger.log;

    const moduleDir = path.join(process.cwd(), ".data", "node_modules_plugins");
    const tempDir = path.join(process.cwd(), ".data", "temp_npm_pack");

    global.ensureExists(moduleDir);
    global.ensureExists(tempDir);

    let downloadPackage = async function downloadPackage(packageName, versionRange) {
        // Clean temp folder first before downloading
        try {
            await fs.promises.unlink(path.join(tempDir, "package.json"));
            await fs.promises.rmdir(path.join(tempDir, "node_modules"), { recursive: true });
        } catch (_) { }

        await fs.promises.writeFile(path.join(tempDir, "package.json"), emptyPKGJSON);
        try {
            await new Promise((resolve, reject) => {
                let p = childProcess.spawn("npm", ["install", `${packageName}@${versionRange}`], {
                    cwd: tempDir,
                    shell: true,
                    stdio: "inherit"
                });
                p.once("exit", async (code, signal) => {
                    if (code !== 0 && signal !== null) {
                        return reject([code, signal]);
                    }

                    // Intended wait
                    await new Promise(_ => setTimeout(_, 500));

                    // Uh..
                    global.ensureExists(path.join(
                        moduleDir,
                        packageName
                    ));

                    // Get installed version
                    let installedVersion = JSON.parse(await fs.promises.readFile(path.join(tempDir, "node_modules", packageName, "package.json"), {
                        encoding: "utf8"
                    })).version;

                    await fs.promises.rename(
                        path.join(tempDir, "node_modules", packageName),
                        path.join(
                            moduleDir,
                            packageName,
                            installedVersion
                        )
                    );
                    await fs.promises.rename(
                        path.join(tempDir, "node_modules"),
                        path.join(
                            moduleDir,
                            packageName,
                            installedVersion,
                            "node_modules"
                        )
                    );

                    try {
                        await fs.promises.unlink(path.join(tempDir, "package.json"));
                        try {
                            await fs.promises.unlink(path.join(tempDir, "package-lock.json"));
                        } catch (_) { }
                    } catch (_) {
                        return reject([null, null, _]);
                    }
                    resolve();
                });
            });
        } catch (ex) {
            throw new Error("No such package exists.");
        }
    }

    let checkPackageExists = async function checkPackageExists(packageName, versionRange) {
        if (fs.existsSync(path.join(moduleDir, packageName))) {
            if ((await fs.promises.lstat(path.join(moduleDir, packageName))).isDirectory()) {
                let packageDir = await fs.promises.readdir(path.join(moduleDir, packageName), {
                    withFileTypes: true
                });

                for (let v of packageDir.filter(v => v.isFile())) {
                    await fs.promises.unlink(path.join(moduleDir, packageName, v.name));
                }

                let versionList = packageDir
                    .filter(v => v.isDirectory()).map(v => v.name)
                    .sort((vA, vB) => semver.compare(vA, vB))
                    .reverse();

                for (let version of versionList) {
                    if (semver.satisfies(version, versionRange)) return version;
                }

                return false;
            } else {
                await fs.promises.unlink(path.join(moduleDir, packageName));
                return false;
            }
        } else return false;
    }

    /**
     * Download a NPM package if not exists, then load that package.
     * 
     * @param {string} packageName Package name
     * @param {string} versionRange Version range
     * 
     * @returns {Promise<any>} module.exports of that package
     */
    return async function loadPackage(packageName, versionRange) {
        for (; ;) {
            let version = await checkPackageExists(packageName, versionRange);
            if (!version) {
                try {
                    log(`Downloading NPM package: ${packageName} | Range: ${versionRange}`);
                    await downloadPackage(packageName, versionRange);
                    version = await checkPackageExists(packageName, versionRange);
                    log(`Downloaded NPM package: ${packageName} | Version: ${version}`);
                } catch (_) {
                    throw new Error("No such package exists on NPM registry.");
                }
            }

            let rtData;
            try {
                rtData = require(path.join(moduleDir, packageName, version));
            } catch (_) {
                await fs.promises.rmdir(path.join(moduleDir, packageName, version), { recursive: true });
                continue;
            }
            return rtData;
        }
    }
}
let path = require("path");
module.exports = async function startFinder(__GLOBAL) {
    let formatHandler = __GLOBAL.pluginFormatHandler;
    let Logger = __GLOBAL.Logger;
    let logger = new __GLOBAL.Logger("PluginFinder");

    logger.verb("Checking for *.zip in the plugins directory...");
    /** @type {string[]} */
    let fileList = __GLOBAL.findFromDir(path.resolve(process.cwd(), String(process.env.PLUGIN_LOCATION)), /^.*\.zip$/, true, false);

    logger.verb("Checking for *.npp in the plugins directory (Nikola Plugin Placeholder)...");
    fileList = fileList.concat(__GLOBAL.findFromDir(path.resolve(process.cwd(), String(process.env.PLUGIN_LOCATION)), /^.*\.npp$/, true, false));

    for (let url of fileList) {
        // Resolve this to plugin and automaticially load it.
        try {
            logger.verb(`Trying to load ${url}...`);
            await formatHandler.load("file://" + url);
        } catch (e) {
            logger.error(`Failed to load plugin at file://${url}:`, e);
        }
    }
}

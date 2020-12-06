let path = require("path");
module.exports = async function startFinder(__GLOBAL) {
    let formatHandler = __GLOBAL.pluginFormatHandler;
    let logger = new __GLOBAL.Logger("PluginFinder");

    logger.verb("Checking for *.zip in the plugins directory...");
    /** @type {string[]} */
    let fileList = __GLOBAL.findFromDir(path.resolve(process.cwd(), String(process.env.PLUGIN_LOCATION)), /^.*\.zip$/, true, false);

    logger.verb("Checking for *.npp in the plugins directory (Nikola Plugin Placeholder)...");
    fileList = fileList.concat(__GLOBAL.findFromDir(path.resolve(process.cwd(), String(process.env.PLUGIN_LOCATION)), /^.*\.npp$/, true, false));

    // Moved to pluginFormatHandler to ensure dependencies.
    let e = await formatHandler.batchLoad(fileList.map(x => "file://" + x));

    e.forEach(x => logger.error(x));
}

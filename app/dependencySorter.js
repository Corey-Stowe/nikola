/* 
    Copyright (C) 2020  BadAimWeeb/TeamDec1mus

    Sort items by dependency.
*/

module.exports = function sortDependency(obj) {
    return sort(buildTree(obj, obj));
}

function buildTree(obj, baseObj) {
    let res = {};
    for (let n in obj) {
        res[n] = obj[n].reduce((a, i) => {
            a[i] = baseObj[i].filter(x => x != null);
            return a;
        }, {});
        res[n] = buildTree(res[n], baseObj);
    }
    return res;
}

function fTree(arr, obj, prefix) {
    for (let k in obj) {
        arr.push(prefix + k);
        if (typeof obj[k] === "object") {
            fTree(arr, obj[k], prefix + k + "\x1F");
        }
    }
}

function sort(tree) {
    let s = [];
    fTree(s, tree, "");
    s = filterByLevel(s).reverse().flat(Infinity).map(x => {
        let y = x.split("\x1F");
        return y[y.length - 1];
    }).filter((v, i, a) => a.indexOf(v) === i);
    return s;
}

function filterByLevel(arr) {
    let res = [];
    for (let i of arr) { 
        let l = i.split("\x1F").length;
        if (res[l - 1] == null) res[l - 1] = [];
        res[l - 1].push(i);
    }
    return res;
}
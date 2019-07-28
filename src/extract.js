var fs = require('fs');
var path = require('path');
var file = {};

file.isroot = function(str) {
  if (process.platform === 'win32') {
    return path.normalize(str).slice(1, 3) === ':\\';
  } else {
    return str.charAt(0) === '/';
  }
};

file.abspath = function(str, base) {
  if (!file.isroot(str)) {
    return path.normalize(path.join(base || process.cwd(), path.normalize(str)));
  }
  return str;
};

file.read = function(filepath) {
  return fs.readFileSync(filepath, 'utf8');
};

file.exists = function(filepath) {
  return fs.existsSync(filepath);
};

// 提取 /* public Dom__setHtml */
function findKeyword(str) {
    var reg = '(?:/\\* +(?:public|exported) +([^ ]*?) +\\*/|export +(?:function|const) +(\\w+))';
    var names = str.match(new RegExp(reg, 'g'));
    if (!names) {
        return [];
    }
    return names.map(function(name) {
        var match = name.match(new RegExp(reg));
        return match[1] || match[2];
    });
}

// 解析include([...])
// 只解析直接相关的文件，不进行递归查找
function parseIncluded(cnt) {
    var include = function(list) {
        return list;
    };
    var match = cnt.match(/include\s*\([\s\S]+?\)/);
    if (!match) {
        return;
    }
    return eval(match[0]);
}

// 根据当前文件提取出所有全局函数
// 引用模块下的/* (exports|public) */
function extractGlobals(target) {
    // 找到当前模块的all.js
    var dirname = path.dirname(target);
    var all = findInclude(target);
    if (!all) {
        return [];
    }
    var files = parseIncluded(file.read(all));

    return files.reduce(function(mem, item) {
        return mem.concat(findKeyword(file.read(file.abspath(item, dirname))));
    }, []);
}

function findInclude(target) {
    // 如果自身包含返回自身
    if (file.read(target).indexOf('include([') !== -1) {
        return target;
    }
    // 如果同级目录下有all.js,
    // 可以把all.js里面的include当做公共include
    var dirname = path.dirname(target);
    var all = file.abspath('all.js', dirname)
    if (file.exists(all)) {
        return all;
    }
}

module.exports = extractGlobals;
module.exports.findInclude = findInclude;
module.exports.parseIncluded = parseIncluded;
module.exports.findKeyword = findKeyword;

"use strict";

// inspired by: eslint-plugin-html

var path = require("path");
var extractGlobals = require("./extract");
var tmpl = require("./tmpl");
var fs = require('fs')

var needle = path.join("bin", "eslint.js");
var eslint;
for (var key in require.cache) {
  if (key.indexOf(needle, key.length - needle.length) >= 0) {
    eslint = require(key);
    if (typeof eslint.verify === "function") {
      break;
    }
  }
}

if (!eslint) {
  throw new Error("eslint-plugin-viper error: It seems that eslint is not loaded. ");
}

var linterProto = require("eslint").Linter.prototype;

function createProcessor() {
    // 注入Linter代码，动态修改config的值
    // 文件位置：eslint/lib/linter/linter.js
    /*
      调用顺序：
      eslint (bin/eslint.js)
      -> cli.execute (lib/cli.js)
      -> engine.executeOnFiles -> verifyText (lib/cli-engine/cli-engine.js)
      -> linter.verifyAndFix -> linter.verify -> linter._verifyWithoutProcessors ->  (lib/linter/linter.js)
         */
    const verify = linterProto._verifyWithoutProcessors;

    function inject() {
        linterProto._verifyWithoutProcessors = function (textOrSourceCode, providedConfig, providedOptions) {
            providedConfig.globals = {
                ...providedConfig.globals,

                // 提取/* exported|public */， 扩展global字段
                ...extractGlobals(providedOptions.filename).reduce((acc, curr) => {
                    return {
                        ...acc,
                        [curr]: true,
                    }
                }, {
                    include: true, // include是旧的模块管理函数，作为全局变量
                })
            }

            const exportedVars = extractGlobals.findKeyword(textOrSourceCode);

            return verify.call(this, textOrSourceCode + `\n${exportedVars.join(';')}${exportedVars.length ? ';' : ''}`, providedConfig, providedOptions);
        };
    }

    function recover() {
        linterProto._verifyWithoutProcessors = verify;
    }

    return {
        preprocess: function (source, filename) {
            inject();
            return [ tmpl(source) ];
        },
        postprocess: function(messages, filename) {
            recover();
            return [].concat(...messages);
        },
    };

}

var processors = {};
processors['.js'] = createProcessor(false);
processors['.vp'] = createProcessor(false);

exports.processors = processors;

//--- 测试内容 ----------------------------------------------
if (process.argv[2] !== '__test__') {
    return;
}

console.log('====== extractGlobals ======');
console.assert(extractGlobals('foo/all.js')[1] == 'Dom__setHtml');
console.assert(extractGlobals('foo/index.js')[1] == 'Dom__setHtml');


console.log('====== recurseUpFindFile ======');
console.assert(
    file.recurseUpFindFile('all.js', 'foo') ==
    file.abspath('foo/all.js', __dirname),
    '当前目录'
);
console.assert(
    file.recurseUpFindFile('.vimrc', __dirname) ==
    file.abspath('.vimrc', process.env['HOME']),
    '递归查找'
);

console.log('====== findKeyword ======');
var ALL_FILE = `
include([
'./index.js'
]);

/* public Dom__setHtml */
/* exported Dom__setHtml */
`;
console.assert(findKeyword(ALL_FILE, 'public')[0] == 'Dom__setHtml');
console.assert(findKeyword(ALL_FILE, 'exported')[0] == 'Dom__setHtml');

console.log('====== parseIncluded ======');
console.assert(parseIncluded(ALL_FILE)[0] == './index.js');

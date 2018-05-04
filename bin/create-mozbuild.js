/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at <http://mozilla.org/MPL/2.0/>. */

const glob = require("glob");
const fs = require("fs");
const path = require("path");
const shell = require("shelljs");

const srcPath = process.argv[2];
console.log("source path", srcPath);
if (!srcPath || !fs.existsSync(srcPath) || !fs.existsSync(path.join(srcPath, "main.js"))) {
  throw new Error("Need to pass a valid debugger source folder to get sources from: " + srcPath);
}

const dstPath = srcPath;
console.log("destination path", dstPath);
if (!dstPath) {
  throw new Error("Need to pass an empty destination path to put mozbuild file: " + dstPath);
}

const buildTpl = `# vim: set filetype=python:
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

__DIRS__

__FILES__
`;

function ignoreFile(file) {
  return file.match(/(\/fixtures|\/test|vendors\.js|types\.js|types\/)/);
}

function getFiles() {
  return glob.sync(srcPath + "/**/*.js", {}).filter((file) => !ignoreFile(file));
}

function mozBuilds() {
  const builds = {};

  getFiles().forEach(file => {

    let dir = path.dirname(file);
    builds[dir] = builds[dir] || { files: [], dirs: [] };
    builds[dir].files.push(path.basename(file));
    let parentDir = path.dirname(dir);
    const directory = path.basename(dir);

    console.log(file, dir, parentDir);

    builds[parentDir] = builds[parentDir] || { files: [], dirs: [] };
    if (!builds[parentDir].dirs.includes(directory)) {
      builds[parentDir].dirs.push(directory);
    }

    while (parentDir != ".") {
      parentDir = path.dirname(parentDir);
      dir = path.dirname(dir);
      const directoryName = path.basename(dir);

      builds[parentDir] = builds[parentDir] || { files: [], dirs: [] };

      if (parentDir.includes("search")) {
        console.log(parentDir, directoryName);
      }

      if (!builds[parentDir].dirs.includes(directoryName)) {
        builds[parentDir].dirs.push(directoryName);
      }
    }
  });

  Object.keys(builds).forEach(build => {
    if (build == ".") {
      return;
    }
    const { files, dirs } = builds[build];

    const buildPath = build;
    shell.mkdir("-p", buildPath);

    let fileStr = "";
    if (files.length > 0) {
      fileStr = "DebuggerModules(\n" +
        files
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
        .map(file => `    '${file}',`)
        .join("\n") +
        "\n)";
    }


    let dirStr = "";
    if (dirs.length > 0) {
      dirStr = "DIRS += [\n" +
        dirs
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
        .map(dir => `    '${dir}',`)
        .join("\n") +
        "\n]";
    }

    const src = buildTpl
      .replace("__DIRS__", dirStr)
      .replace("__FILES__", fileStr);

    console.log(buildPath);
    fs.writeFileSync(path.join(buildPath, "moz.build"), src);
  });
}

mozBuilds();

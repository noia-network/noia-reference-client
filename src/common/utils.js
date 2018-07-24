const fs = require('fs');
const util = require('util');

// Convert fs.readFile into Promise version of same
const readFileAsync = util.promisify(fs.readFile);
const writeFileAsync = util.promisify(fs.writeFile);

async function readFile(path) {
  return await readFileAsync(path, "utf8");
}

async function writeFile(path, content) {
  return await writeFileAsync(path, content, "utf8");
}

class TimeoutError extends Error {
  constructor(msg) {
    super(msg);
  }
}

module.exports = {
  readFile,
  writeFile,
  TimeoutError
};

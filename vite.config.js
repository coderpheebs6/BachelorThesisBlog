const { defineConfig } = require("vite");
const path = require("node:path");

module.exports = defineConfig({
  root: "frontend",
  publicDir: path.resolve(__dirname, "js"),
});

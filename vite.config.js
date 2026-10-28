const { defineConfig } = require("vite");
const path = require("node:path");

module.exports = defineConfig({
  root: "frontend",
  base: "/BachelorThesisBlog/",
  publicDir: path.resolve(__dirname, "js"),
});

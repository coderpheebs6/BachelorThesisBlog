const { defineConfig } = require("vite");
const path = require("node:path");

module.exports = defineConfig({
  root: "frontend",
  base: "/BachelorThesisBlog/",
  publicDir: path.resolve(__dirname, "js"),
  build: {
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, "frontend/index.html"),
        team: path.resolve(__dirname, "frontend/team.html"),
        ux: path.resolve(__dirname, "frontend/ux.html"),
        design: path.resolve(__dirname, "frontend/design.html"),
        code: path.resolve(__dirname, "frontend/code.html"),
        article: path.resolve(__dirname, "frontend/article.html"),
      },
    },
  },
});

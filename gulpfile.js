"use strict";

const gulp = require("gulp");
const helper = require("electrode-gulp-helper");
const shell = helper.shell;
const exec = helper.exec;
const fs = require("fs");
const path = require("path");
const yoTest = require("yeoman-test");
const _ = require("lodash");

if (!process.env.PACKAGES_DIR) {
  process.env.PACKAGES_DIR = path.resolve("packages");
}

const runAppTest = (dir, forceLocal) => {
  const localPkgs = ["electrode-archetype-react-app", "electrode-react-webapp", "electrode-redux-router-engine", "electrode-auto-ssr"];
  const localDevPkgs = ["electrode-archetype-react-app-dev"];

  const updateToLocalPkgs = (pkgSection, pkgs) => {
    if (pkgSection) {
      pkgs.forEach((pkg) => {
        if (pkgSection[pkg]) {
          pkgSection[pkg] = path.join(process.env.PACKAGES_DIR, pkg);
        }
      });
    }
  };

  const appPkgFile = `${dir}/package.json`;
  let appPkgData;

  if (forceLocal || process.env.BUILD_TEST) {
    appPkgData = fs.readFileSync(appPkgFile).toString();
    const appPkg = JSON.parse(appPkgData);
    updateToLocalPkgs(appPkg["dependencies"], localPkgs);
    updateToLocalPkgs(appPkg["devDependencies"], localDevPkgs);
    fs.writeFileSync(appPkgFile, `${JSON.stringify(appPkg, null, 2)}\n`);
  }

  shell.pushd(dir);

  const restore = () => {
    shell.popd();
    if (appPkgData) {
      fs.writeFileSync(appPkgFile, appPkgData);
    }
  };

  return exec(`npm i`)
    .then(() => exec(`npm test`))
    .then(restore)
    .catch((err) => {
      restore();
      throw err;
    });
};

const testGenerator = (testDir, clean, prompts) => {
  const yoApp = path.join(process.env.PACKAGES_DIR, ("generator-electrode/generators/app/index.js"));
  const defaultPrompts = {
    name: "test-app",
    description: "test test",
    homepage: "http://test",
    serverType: "ExpressJS",
    authorName: "John Smith",
    authorEmail: "john@smith.com",
    authorUrl: "http://www.test.com",
    keywords: ["test", "electrode"],
    pwa: true,
    autoSsr: true,
    createDirectory: true,
    githubAccount: "test",
    license: "Apache-2.0"
  };
  prompts = _.extend({}, defaultPrompts, prompts || {});

  const yoRun = yoTest.run(yoApp);
  return (clean ? yoRun.inDir(testDir) : yoRun.cd(testDir))
    .withOptions({
      "skip-install": true
    })
    .withPrompts(prompts)
    .then(() => runAppTest(path.join(testDir, "test-app"), true));
};

helper.loadTasks({
  "build-test": {
    task: () => {
      process.env.BUILD_TEST = "true";
      let updated;
      return exec("lerna updated")
        .then((output) => {
          updated = output.stdout.split("\n").filter((x) => x.startsWith("- ")).map((x) => x.substr(2));
        })
        .then(() => {
          if (updated.indexOf("generator-electrode") >= 0) {
            return exec("gulp test-generator");
          }
        })
        .then(() => exec("gulp test-boilerplate"));
    }
  },

  "test-boilerplate": {
    task: () => runAppTest(path.resolve("samples/universal-react-node"))
  },

  "test-generator": {
    task: () => {
      const testDir = path.resolve("tmp");
      return testGenerator(testDir, true, {serverType: "ExpressJS"})
        .then(() => {
          const appFiles = ["package.json", "client", "config", "server", "test"];
          shell.rm("-rf", appFiles.map((x) => path.join(testDir, "test-app", x)));
        })
        .then(() => testGenerator(testDir, false, {serverType: "HapiJS"}));
    }
  }
}, gulp);

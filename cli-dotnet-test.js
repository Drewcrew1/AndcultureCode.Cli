#!/usr/bin/env node

/**************************************************************************************************
 * Imports
 **************************************************************************************************/

const commands    = require("./_modules/commands");
const dir         = require("./_modules/dir");
const dotnetBuild = require("./_modules/dotnet-build");
const dotnetPath  = require("./_modules/dotnet-path");
const echo        = require("./_modules/echo");
const formatters  = require("./_modules/formatters");
const program     = require("commander");
const shell       = require("shelljs");
const { spawn }   = require("child_process");

/**************************************************************************************************
 * Variables
 **************************************************************************************************/

const coverageFlags = " -p:CollectCoverage=true -p:CoverletOutputFormat=opencover";

/**************************************************************************************************
 * Commands
 **************************************************************************************************/

// #region Commands

const dotnetTest = {
    cmds: {
        dotnetTest:       "dotnet test --no-build --no-restore",
        dotnetTestFilter: "dotnet test --no-build --no-restore --filter",
    },
    descriptionSkipClean() {
        return "Skips the clean, build, and restore steps before running the dotnet test runner. This will speed up sequential runs if intentionally running on the same assemblies.";
    },
    description() {
        return `Runs dotnet test runner on the ${dotnetPath.solutionPath()} solution (via ${this.cmds.dotnetTest})`;
    },
    runByProject() {
        // Check for the solution path before attempting any work
        dotnetPath.solutionPathOrExit();

        const solutionDir = dotnetPath.solutionDir();
        dir.pushd(solutionDir);
            
        const testProjects = shell.find("**/*.Test*.csproj");
        if (testProjects == null || testProjects.length === 0) {
            echo.error("Could not find any csproj files matching the pattern *.Test*.csproj.");
            shell.exit(1);
        }

        echo.message(`Found ${testProjects.length} test projects in the ${dotnetPath.solutionDir()} solution...`);

        let cmd = this.cmds.dotnetTest;

        if (program.coverage) {
            cmd += coverageFlags;
        }

        testProjects.map((project) => {
            echo.message(`Running tests in the ${project} project... via (${cmd} ${project})`);

            const child = spawn(`${cmd} ${project}`, { stdio: "inherit", shell: true });
            child.on("exit", (code, signal) => {
                if (code !== 0) {
                    echo.error(`Exited with error '${signal}'`);
                    shell.exit(code);
                }

                echo.newLine();
                echo.success(`Tests for ${project} succeeded.`);
            });
        })

        dir.popd();
    },
    runBySolution(skipClean) {
        // Check for the solution path before attempting any work
        dotnetPath.solutionPathOrExit();

        if (!skipClean) {
            dotnetBuild.run(true, true);
        }

        const solutionDir = dotnetPath.solutionDir();

        dir.pushd(solutionDir);

        let cmd     = this.cmds.dotnetTest;
        let message = `Running all tests in the ${dotnetPath.solutionPath()} solution... via (${cmd})`;

        if (program.args.length > 0) {
            const filter = program.args;
            message = `Running tests in the ${dotnetPath.solutionPath()} solution that match the xunit filter of '${filter}' via (${this.cmds.dotnetTestFilter})`;
            cmd = `${this.cmds.dotnetTestFilter} ${filter}`;
        }

        if (program.coverage) {
            cmd += coverageFlags
        }

        echo.message(message);

        const child = spawn(cmd, { stdio: "inherit", shell: true });
        child.on("exit", (code, signal) => {
            if (code !== 0) {
                echo.error(`Exited with error '${signal}'`);
                shell.exit(code);
            }

            dir.popd();
            echo.newLine();
            echo.message("Exited dotnet-test");
        });
    },
};

// #endregion Commands


/**************************************************************************************************
 * Entrypoint / Command router
 **************************************************************************************************/

// #region Entrypoint / Command router

program
    .usage("option")
    .description(dotnetTest.description())
    .option("--by-project", "Runs all test projects for the solution in serial")
    .option("--coverage",  "Additionally run tests with code coverage via coverlet")
    .option("-s, --skip-clean", dotnetTest.descriptionSkipClean())
    .parse(process.argv);

if (!program.byProject) {
    dotnetTest.runBySolution(program.skipClean);
}

if (program.byProject === true) {
    dotnetTest.runByProject();
}

// #endregion Entrypoint / Command router

exports.dotnetTest = dotnetTest;

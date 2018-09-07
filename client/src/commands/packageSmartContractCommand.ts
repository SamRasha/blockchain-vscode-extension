/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
*/
'use strict';
import * as vscode from 'vscode';
import { window } from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as homeDir from 'home-dir';
import * as util from 'util';
import * as glob from 'glob';
import { VSCodeOutputAdapter } from '../logging/VSCodeOutputAdapter';
import {CommandsUtil} from './commandsUtil';
const Glob = util.promisify(glob.Glob);

/**
 * Main function which calls the methods and refreshes the blockchain explorer box each time that it runs succesfully.
 * This will be used in other files to call the command to package a smart contract project.
 */
export async function packageSmartContract(): Promise<void> {
    let packageDir: string = vscode.workspace.getConfiguration().get('fabric.package.directory');

    try {
        packageDir = await getBasePackageDir(packageDir);
        await createPackageDir(packageDir);
        await vscode.commands.executeCommand('blockchainAPackageExplorer.refreshEntry');
    } catch (err) {
        vscode.window.showErrorMessage(err);
    }
}
/**
 * Method to replace ~ (if in the directory) with the users home directory into the packageDir so as to be compatible with all OS's.
 * @param {String} packageDir String containing the path of the directory of packaged smart contracts defined in User Settings.
 * @returns {String} Returns packageDir.
 *
 */
async function getBasePackageDir(packageDir): Promise<string> {

    if (packageDir.startsWith('~')) {
        packageDir = await homeDir(packageDir.replace('~', ''));
    }
    return packageDir;
}
/**
 * This method checks to see whether the smart contract project contains JavaScript, Typescript or go files to determine the chosen language of this project.
 * It then calls one of two methods, packageJsonNameAndVersion() and golandPackageAndVersion(), and uses the retrieved information to determine the absolute path of the package directory
 * and calls the createAndPackage method with this full directory.
 * @param {String} packageDir A string containing the path of the directory of packaged smart contracts defined in User Settings.
 */
async function createPackageDir(packageDir): Promise<void> {
    const workspaceDir: string = await chooseWorkspace();
    const dir: string = await getFinalDirectory(packageDir, workspaceDir);
    await createAndPackage(dir, workspaceDir);
}
/**
 * Method to determine if there are multiple smart contracts within the active workspace. If so, it will provide a quick pick box
 * to have the developer choose which smart contract he wishes to package and get its path. If not, it will automatically get the path of the only smart contract project there is.
 * @returns Returns the path of the workspace to be used in packaging process.
 */
async function chooseWorkspace(): Promise<string> {
    const outputAdapter: VSCodeOutputAdapter = VSCodeOutputAdapter.instance();
    const workspace: vscode.WorkspaceFolder[] = vscode.workspace.workspaceFolders;
    let workspaceFolderOptions: string[];
    let workspaceFolder: string;

    outputAdapter.log('Getting workspace folders...');
    try {
        workspaceFolderOptions = await CommandsUtil.getWorkspaceFolders();
    } catch (error) {
        const message: string = 'Issue determining available workspace folder options';
        window.showErrorMessage(message);
        throw new Error(message);
    }
    if (workspaceFolderOptions.length > 1) {
        workspaceFolder = await CommandsUtil.showGolangQuickPickBox('Choose a workspace folder to package');
    } else {
        workspaceFolder = workspaceFolderOptions[0];
    }
    if (!workspaceFolderOptions.includes(workspaceFolder)) {
        // User has cancelled the QuickPick box
        return;
    }
    for (const folder of workspace) {
        if (folder.name === workspaceFolder) {
            return folder.uri.path;
        }
    }
}
/**
 * This method uses a glob function to go through all directories and sub-directories in the active workspace to determine what
 * language was used to develop this smart contract.
 * @param {String} packageDir Package directory which is defined in User Settings. This is the directory where smart contracts will be packaged to.
 * @param {String} workspaceDir Path of the active smart contract to be packaged.
 * @returns {String, String} Returns the full directory of where the smart contract will be found within the package directory, and an error message to be used in the creation of these directory if needed.
 */
async function getFinalDirectory(packageDir, workspaceDir) {
    let language: string;
    let properties: any = {};
    language = await getLanguage(workspaceDir);

    if (!language) {
        const message: string = 'Failed to determine workspace language type, please ensure your project contains a chaincode file in the correct format (**/*.js, **/.ts, **/*.go)!';
        vscode.window.showErrorMessage(message);
        throw new Error(message);
    }
    if (language === '/go/src/') {
        properties = await golangPackageAndVersion();
    } else {
        properties = await packageJsonNameAndVersion(workspaceDir);
    }
    const dir: string = path.join(packageDir, language, properties.workspacePackageName + '@v' + properties.workspacePackageVersion);
    try {
        // Checking to see if there is an existing package with the same name and version
        const stat: fs.Stats = await fs.stat(dir);
        if (stat.isDirectory() === true) {
            let message: string;
            if (language === '/go/src/') {
                message = 'Could not create package directory, please input a different name or version for your go project.';
            } else {
                message = 'Please change the name and/or the version of the project in your package.json file.';
            }
            vscode.window.showErrorMessage(message);
            throw new Error(message);
        }
    } catch (err) {
        if (err.code === 'ENOENT') { // If the directory does not exist, it will create and package the Smart Contract
            return dir;
        }
        vscode.window.showErrorMessage(err);
        throw new Error(err);
    }
}
/**
 * Method to determine the language used in the development of the smart contract project, which will be used to determine the correct directories
 * to package the projects.
 * @param workspaceDir {String} workspaceDir A string containing the path to the current active workspace (the workspace of the project the user is packaging).
 * @returns An object of 3 arrays which contain the names of the JavaScript, TypeScript and golang files in the currently active workspace.
 */
async function getLanguage(workspaceDir): Promise<string> {
    let language: string;

    const jsFiles = await Glob('**/*.js', {
        cwd: workspaceDir, ignore: '**/node_modules/**'
    });
    const tsFiles = await Glob('**/*.ts', {
        cwd: workspaceDir, ignore: '**/node_modules/**'
    });
    const goFiles = await Glob('**/*.go', {
        cwd: workspaceDir, ignore: '**/node_modules/**'
    });

    if (jsFiles.length > 0 && tsFiles.length > 0) {
        language = '/typescript/';
    } else if (tsFiles.length > 0 && jsFiles.length === 0) {
        const message = 'Please ensure you have compiled your typescript files into javascript.';
        vscode.window.showErrorMessage(message);
        throw new Error(message);
    } else if (goFiles.length > 0) {
        language = '/go/src/';
    } else if (jsFiles.length > 0) {
        language = '/javascript/';
    }
    return language;
}
/**
 * Method to retrieve the package name and version from the projects package.json file, and returns them to be used in the createPackageDir() method.
 * @param workspaceDir {String} workspaceDir A string containing the path to the current active workspace (the workspace of the project the user is packaging).
 * @returns Returns an object with the workspacePackageName and workspacePackageVersion which will be used in the createPackageDir() method.
 */
async function packageJsonNameAndVersion(workspaceDir) {
    const workspacePackage = path.join(workspaceDir, '/package.json');
    const workspacePackageContents: Buffer = await fs.readFile(workspacePackage);
    const workspacePackageObj: any = JSON.parse(workspacePackageContents.toString('utf8'));
    const workspacePackageName: string = workspacePackageObj.name;
    const workspacePackageVersion: string = workspacePackageObj.version;

    if (!workspacePackageName || !workspacePackageVersion) {
        const message: string = 'Please enter a package name and/or package version into your package.json';
        vscode.window.showErrorMessage(message);
        throw new Error(message);
    }
    return { workspacePackageName, workspacePackageVersion };
}
/**
 * Method which creates and input box should the project be coded in golang, which asks the user for a package name and version
 * (as golang projects do not contain a package.json file), and returns an object containing both these values.
 * @returns Returns an object with the workspacePackageName and workspacePackageVersion which will be used in the createPackageDir() method
 */
async function golangPackageAndVersion() {

    const workspacePackageName = await CommandsUtil.showInputBox('Enter a name for your go package'); // Getting the specified name and package from the user
    if (!workspacePackageName) {
        // User has cancelled the input box
        return;
    }
    const workspacePackageVersion = await CommandsUtil.showInputBox('Enter a version for your go package'); // Getting the specified name and package from the user
    if (workspacePackageVersion) {
        // User has cancelled the input box
        return;
    }
    if (workspacePackageName === '' || workspacePackageVersion === '') {
        const message: string = 'Could not create package directory, please input a name or version for your go project.';
        vscode.window.showErrorMessage(message);
        throw new Error(message);
    }
    return { workspacePackageName, workspacePackageVersion };
}
/**
 * Method to create the directory previously determined in the createPackageDir() method. It will check to see if the directory already exists,
 * hence meaning the developer has tried to package the same smart contract, and if the directory does not exist, will create it and all its subdirectories
 * using 'fs.mkdirp() and package the smart contract project using fs.copy().
 * @param {String} dir A string containing the full absolute path of the packaged smart contract.
 * @param {String} workspaceDir A string containing the path to the current active workspace (the workspace of the project the user is packaging).
 * @param {String} message A string of an error message passed in from the createPackageDir() method with regards to the project's package name and version.
 */
async function createAndPackage(dir, workspaceDir) {
    try {
        await fs.mkdirp(dir);
        await fs.copy(workspaceDir, dir);
        vscode.window.showInformationMessage('Smart Contract packaged: ' + dir);
    } catch (err) {
        vscode.window.showErrorMessage(err);
        throw new Error (err);
    }
}

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
import * as path from 'path';
import * as myExtension from '../../src/extension';
import * as util from 'util';
import * as glob from 'glob';
import * as fs from 'fs-extra';
const Glob = util.promisify(glob.Glob);

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { TestUtil } from '../TestUtil';
import { packageSmartContract } from '../../src/commands/packageSmartContractCommand';
import { VSCodeOutputAdapter } from '../../src/logging/VSCodeOutputAdapter';
import { UserInputUtil } from '../../src/commands/UserInputUtil';
import { fileSync } from 'tmp';

chai.should();
chai.use(sinonChai);
// tslint:disable no-unused-expression
describe('packageSmartContract', () => {
    const mySandBox: sinon.SinonSandbox = sinon.createSandbox();
    let errorSpy: sinon.SinonSpy;
    let informationSpy: sinon.SinonSpy;
    let showInputStub: sinon.SinonStub;
    let workspaceFoldersStub: sinon.SinonStub;
    let showWorkspaceQuickPickStub: sinon.SinonStub;
    const rootPath: string = path.dirname(__dirname);
    const originalPackageDir: string = vscode.workspace.getConfiguration().get('fabric.package.directory');
    const fileDest = path.join(rootPath, '../../test/data/packageContractDir');
    const testWorkspace = path.join(rootPath, '../../test/data/testWorkspace');
    const javascriptPath = path.join(rootPath, '../../test/data/testWorkspace/javascriptProject');
    const typescriptPath = path.join(rootPath, '../../test/data/testWorkspace/typescriptProject');
    const emptyContent: string = '';

    const golangPath = path.join(rootPath, '../../test/data/testWorkspace/goProject');
    const folders: Array<any> = [
        {name: 'javascriptProject', path: javascriptPath},
        {name: 'typescriptProject', path: typescriptPath},
        {name: 'goProject', path: golangPath}
    ];
    const languages: Array<string> = [
        '/javascript/',
        '/typescript/',
        '/go/src/'
    ];
    async function createTestFiles(packageName: string, version: string, language: string, createValid: boolean): Promise<void> {
        const workspaceDir = path.join(rootPath, '../../test/data/testWorkspace/' + packageName );

        try {
            await fs.mkdirp(workspaceDir);
        } catch (error) {
            console.log(error);
        }

        if (createValid) {
            if (language !== 'golang') {
                const packageJsonFile: string = workspaceDir + '/package.json';
                const jsChaincode: string = workspaceDir + '/chaincode.js';
                const jsonContent: any = {
                    name: `${packageName}`,
                    version: version,
                    description: 'My Smart Contract',
                    author: 'John Doe',
                    license: 'Apache-2.0'
                };
                if (language === 'typescript') {
                    const textFile: string = workspaceDir + '/chaincode.ts';
                    await fs.writeFile(textFile, emptyContent);
                }
                await fs.writeFile(jsChaincode, emptyContent);
                await fs.writeFile(packageJsonFile, JSON.stringify(jsonContent));
            } else if (language === 'golang') {
                const goChaincode: string = workspaceDir + '/chaincode.go';
                await fs.writeFile(goChaincode, emptyContent);
            }
        } else {
            const textFile = workspaceDir + '/text.txt';
            const content = 'hello';
            await fs.writeFile(textFile, content);
        }
    }

    async function deleteTestFiles(deletePath) {
        try {
            await fs.remove(deletePath);
        } catch (error) {
            if (!error.message.contains('ENOENT: no such file or directory')) {
                throw error;
            }
        }
    }

    before(async () => {
        await TestUtil.setupTests();
        await fs.mkdirp(fileDest);
    });

    describe('#packageSmartContract', () => {

        beforeEach(async () => {
            errorSpy = mySandBox.spy(vscode.window, 'showErrorMessage');
            showInputStub = mySandBox.stub(UserInputUtil, 'showInputBox');
            showWorkspaceQuickPickStub = mySandBox.stub(UserInputUtil, 'showWorkspaceQuickPickBox');
            workspaceFoldersStub = mySandBox.stub(UserInputUtil, 'getWorkspaceFolders');
            informationSpy = mySandBox.spy(vscode.window, 'showInformationMessage');
            await vscode.workspace.getConfiguration().update('fabric.package.directory', fileDest, true);
        });

        afterEach(async () => {
            await deleteTestFiles(fileDest);
            await deleteTestFiles(testWorkspace);
            mySandBox.restore();
            await vscode.workspace.getConfiguration().update('fabric.package.directory', originalPackageDir, true);

        });
        it.only('should package the javascript project', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 0;
            const language = languages[testIndex];

            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            const packageDir: string = path.join(fileDest + language, folders[testIndex].name + '@v0.0.1' );
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            const pathToCheck = packageDir;
            const packageJSONDir = path.join(packageDir , '/package.json');
            const smartContractEntities = path.join(packageDir, '/chaincode.js');
            const smartContractExists = await fs.pathExists(pathToCheck);
            const packageJSONExists = await fs.pathExists(packageJSONDir);
            const smartContractContains = await fs.pathExists(smartContractEntities);
            const fileContents = await fs.readFile(packageJSONDir, 'utf8');
            const packageJSON = JSON.parse(fileContents);
            smartContractExists.should.equal(true, 'Smart Contract does not exist');
            packageJSONExists.should.equal(true, 'javascript packageJSON does not exist');
            smartContractContains.should.equal(true, 'javascript chaincode file does not exist');
            errorSpy.should.not.have.been.called;
            packageJSON.name.should.equal('javascriptProject');
            packageJSON.version.should.equal('0.0.1');
            packageJSON.description.should.equal('My Smart Contract');
            packageJSON.author.should.equal('John Doe');
            packageJSON.license.should.equal('Apache-2.0');
            informationSpy.should.have.been.calledOnce;
        }).timeout(4000);

        it.only('should package the typescript project', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 1;
            const language = languages[testIndex];
            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            const packageDir: string = path.join(fileDest + language, folders[testIndex].name + '@v0.0.1' );

            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            const pathToCheck = packageDir;
            const packageJSONDir = path.join(packageDir , '/package.json');
            const smartContractExists = await fs.pathExists(pathToCheck);
            const packageJSONExists = await fs.pathExists(packageJSONDir);
            const smartContractEntities = path.join(packageDir, '/chaincode.js');
            const smartContractEntities2 = path.join(packageDir, '/chaincode.ts');
            const smartContractContains = await fs.pathExists(smartContractEntities);
            const smartContractContains2 = await fs.pathExists(smartContractEntities2);
            const fileContents = await fs.readFile(packageJSONDir, 'utf8');
            const packageJSON = JSON.parse(fileContents);
            smartContractExists.should.equal(true, 'Smart Contract does not exist');
            packageJSONExists.should.equal(true, 'typescript packageJSON does not exist');
            smartContractContains.should.equal(true, 'Compiled javascript chaincode file does not exist');
            smartContractContains2.should.equal(true, 'typescript chaincode file does not exist');
            errorSpy.should.not.have.been.called;
            packageJSON.name.should.equal('typescriptProject');
            packageJSON.version.should.equal('0.0.1');
            packageJSON.description.should.equal('My Smart Contract');
            packageJSON.author.should.equal('John Doe');
            packageJSON.license.should.equal('Apache-2.0');
            informationSpy.should.have.been.calledOnce;
        }).timeout(4000);

        it.only('should package the golang project', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 2;
            const language = languages[testIndex];
            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            const packageDir: string = path.join(fileDest + language, folders[testIndex].name + '@v0.0.1' );
            showInputStub.onFirstCall().resolves('goProject');
            showInputStub.onSecondCall().resolves('0.0.1');
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            const pathToCheck = packageDir;
            const smartContractExists = await fs.pathExists(pathToCheck);
            const smartContractEntities = path.join(packageDir, '/chaincode.go');
            const smartContractContains = await fs.pathExists(smartContractEntities);
            smartContractExists.should.equal(true, 'Smart Contract does not exist');
            smartContractContains.should.equal(true, 'golang chaincode file does not exist');
            informationSpy.should.have.been.calledOnce;
            errorSpy.should.not.have.been.called;
        }).timeout(4000);

        it.only('should throw an error as the package json does not contain a name or version', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 0;
            const language = languages[testIndex];
            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            const packageDir: string = path.join(fileDest + language, folders[testIndex].name + '@v0.0.1' );
            await deleteTestFiles(path.join(javascriptPath, '/package.json'));
            await fs.writeFile(path.join(javascriptPath, '/package.json'), emptyContent);
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            const pathToCheck = packageDir;
            const smartContractExists = await fs.pathExists(pathToCheck);
            smartContractExists.should.be.false;
            errorSpy.should.have.been.called;
            // errorSpy.should.have.been.calledOnceWith('Please enter a package name and/or package version into your package.json');
            informationSpy.should.not.have.been.called;
        }).timeout(4000);

        it.only('should throw an error as the project does not contain a chaincode file', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 0;
            const language = languages[testIndex];
            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            const packageDir: string = path.join(fileDest + language, folders[testIndex].name + '@v0.0.1' );
            await deleteTestFiles(path.join(javascriptPath, '/chaincode.js'));
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            const pathToCheck = packageDir;
            const smartContractExists = await fs.pathExists(pathToCheck);
            smartContractExists.should.be.false;
            errorSpy.should.have.been.called;
            // errorSpy.should.have.been.calledOnceWith('Please enter a package name and/or package version into your package.json');
            informationSpy.should.not.have.been.called;
        }).timeout(4000);

        it.only('should throw an error as the project already exists', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 0;
            const language = languages[testIndex];
            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            const packageDir: string = path.join(fileDest + language, folders[testIndex].name + '@v0.0.1' );
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            const pathToCheck = packageDir;
            const packageJSONDir = path.join(packageDir , '/package.json');
            const smartContractEntities = path.join(packageDir, '/chaincode.js');
            const smartContractExists = await fs.pathExists(pathToCheck);
            const packageJSONExists = await fs.pathExists(packageJSONDir);
            const smartContractContains = await fs.pathExists(smartContractEntities);
            const fileContents = await fs.readFile(packageJSONDir, 'utf8');
            const packageJSON = JSON.parse(fileContents);
            smartContractExists.should.equal(true, 'Smart Contract does not exist');
            packageJSONExists.should.equal(true, 'javascript packageJSON does not exist');
            smartContractContains.should.equal(true, 'javascript chaincode file does not exist');
            packageJSON.name.should.equal('javascriptProject');
            packageJSON.version.should.equal('0.0.1');
            packageJSON.description.should.equal('My Smart Contract');
            packageJSON.author.should.equal('John Doe');
            packageJSON.license.should.equal('Apache-2.0');
            informationSpy.should.have.been.calledOnce;
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            errorSpy.should.have.been.calledOnce;
        }).timeout(4000);

        it.only('should fail packaging the typescript project as there is no compiled chaincode.js file', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 1;
            const language = languages[testIndex];
            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            const packageDir: string = path.join(fileDest + language, folders[testIndex].name + '@v0.0.1' );
            await deleteTestFiles(path.join(typescriptPath, '/chaincode.js'));
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            const pathToCheck = packageDir;
            const smartContractExists = await fs.pathExists(pathToCheck);
            smartContractExists.should.be.false;
            errorSpy.should.have.been.called;
            informationSpy.should.not.have.been.called;
        }).timeout(4000);

        it.only('should run execute the refreshEntry command', async () => {
            await createTestFiles('javascriptProject', '0.0.1', 'javascript', true);
            await createTestFiles('typescriptProject', '0.0.1', 'typescript', true);
            await createTestFiles('goProject', '0.0.1', 'golang', true);
            const testIndex = 0;
            const language = languages[testIndex];
            const commandSpy = mySandBox.spy(vscode.commands, 'executeCommand');
            workspaceFoldersStub.returns(folders);
            showWorkspaceQuickPickStub.onFirstCall().resolves({label: folders[testIndex].name, data: folders[testIndex].path});
            await vscode.commands.executeCommand('blockchainAPackageExplorer.packageSmartContractProjectEntry');
            commandSpy.should.have.been.calledWith('blockchainAPackageExplorer.refreshEntry');
        });
    });
    describe('#searchWorkspace', async () => {
        it('should find all the JavaScript/TypeScript/go files in the project using glob()', async () => {
            const globSpy = sinon.spy(Glob);
            await packageSmartContract();
        });
    });
});

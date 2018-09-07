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

import * as Uri from 'urijs';
// import * as rewire from 'rewire';
const Glob = util.promisify(glob.Glob);

import * as chai from 'chai';
import * as sinon from 'sinon';
import * as sinonChai from 'sinon-chai';
import { TestUtil } from '../TestUtil';
import { packageSmartContract } from '../../src/commands/packageSmartContractCommand';
import { VSCodeOutputAdapter } from '../../src/logging/VSCodeOutputAdapter';
// const RewiredPackage = rewire('../../src/commands/packageSmartContractCommand');

chai.should();
chai.use(sinonChai);

describe('packageSmartContract', () => {

    let mySandBox: sinon.SinonSandbox;
    let errorSpy: sinon.SinonSpy;
    let configStub: sinon.SinonStub;
    // let inputNameStub: sinon.SinonStub;
    // let inputVersionStub: sinon.SinonStub;
    // let globStub: sinon.SinonStub;
    // let workspaceStub: sinon.SinonStub;
    // let workspace: sinon.SinonStub;
    // let packageDirStub: sinon.SinonStub;
    let rootPath: string;

    before(async () => {
        await TestUtil.setupTests();
    });

    describe('#packageSmartContract', () => {

        beforeEach(async () => {
            rootPath = path.dirname(__dirname);
            mySandBox = sinon.createSandbox();
            errorSpy = mySandBox.spy(vscode.window, 'showErrorMessage');
            configStub = sinon.stub();
            // inputNameStub = mySandBox.stub(vscode.window, 'showInputBox');
            // inputVersionStub = mySandBox.stub(vscode.window, 'showInputBox');
           // informationSpy = mySandBox.spy(vscode.window, 'showInformationMessage');
            const packagesDir: string = path.join(rootPath, '../../test/data/smartContractDir');
            await vscode.workspace.getConfiguration().update('fabric.package.directory', packagesDir, true);
        });

        afterEach(async () => {
            mySandBox.restore();
            await vscode.workspace.getConfiguration().update('fabric.package.directory', '~/.fabric-vscode/packages', true);
        });
        it.only('should run the command', async () => {
            const packagesDir: string = path.join(rootPath, '../../test/data/smartContractDir');

            await vscode.workspace.getWorkspaceFolder(Uri.parse('/Users/samanrasha/Desktop/GithubRepo/blockchain-vscode-extension/client/test/data/testWorkspace'));
            await vscode.workspace.getConfiguration().update('fabric.package.directory', packagesDir, true);
            await packageSmartContract();
            await packageSmartContract();
        });

        it('should run execute the refreshEntry command', async () => {
            const commandSpy = mySandBox.spy(vscode.commands, 'executeCommand');
            await packageSmartContract();
            commandSpy.should.have.been.calledWith('blockchainAPackageExplorer.refreshEntry');
        });

        it('should replace ~ with the users home directory in the fabric.package.directory path', async () => {
            const packageDir = vscode.workspace.getConfiguration().get('fabric.package.directory');
            await packageSmartContract();

        });
    });
    describe('#searchWorkspace', async () => {
        it('should find all the JavaScript/TypeScript/go files in the project using glob()', async () => {
            const globSpy = sinon.spy(Glob);
            await packageSmartContract();
            // globSpy.should.calledThrice;
        });
    });
});

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

import * as vscode from 'vscode';
import { FabricRuntimeManager } from '../fabric/FabricRuntimeManager';
import { CommandsUtil } from './commandsUtil';
import { RuntimeTreeItem } from '../explorer/model/RuntimeTreeItem';
import { VSCodeOutputAdapter } from '../logging/VSCodeOutputAdapter';
import { FabricRuntime } from '../fabric/FabricRuntime';

export async function toggleFabricRuntimeDevMode(runtimeTreeItem?: RuntimeTreeItem): Promise<void> {
    const runtimeManager: FabricRuntimeManager = FabricRuntimeManager.instance();
    let runtimeName: string;
    if (!runtimeTreeItem) {
        runtimeName = await CommandsUtil.showRuntimeQuickPickBox('Select the Fabric runtime to toggle development mode');
    } else {
        runtimeName = runtimeTreeItem.getName();
    }
    const runtime: FabricRuntime = runtimeManager.get(runtimeName);
    const oldDevelopmentMode: boolean = runtime.isDevelopmentMode();
    const newDevelopmentMode = !oldDevelopmentMode;
    await runtime.setDevelopmentMode(newDevelopmentMode);
    const running: boolean = await runtime.isRunning();
    if (!running) {
        return;
    }
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Blockchain Extension',
        cancellable: false
    }, async (progress, token) => {
        progress.report({ message: `Restarting Fabric runtime ${runtimeName}` });
        const outputAdapter: VSCodeOutputAdapter = VSCodeOutputAdapter.instance();
        await runtime.restart(outputAdapter);
    });
}

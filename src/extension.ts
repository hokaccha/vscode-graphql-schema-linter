import * as vscode from "vscode";
import * as cp from "child_process";

const extensionName = "vscode-graphql-schema-linter";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(`${extensionName}.validate`, validate);

  context.subscriptions.push(disposable);
}

export function deactivate() {}

async function validate() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor found.");
    return;
  }

  const document = editor.document;
  const diagnostics = await lint();
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(extensionName);
  diagnosticCollection.set(document.uri, diagnostics);
}

async function lint(): Promise<vscode.Diagnostic[]> {
  return [
    {
      range: new vscode.Range(0, 0, 0, 5),
      message: "hoge!!",
      severity: vscode.DiagnosticSeverity.Error,
    },
  ];
}

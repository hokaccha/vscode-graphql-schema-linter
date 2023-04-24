import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import { promisify } from "util";

const extensionName = "vscode-graphql-schema-linter";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(`${extensionName}.validate`, validate);

  context.subscriptions.push(disposable);
}

export function deactivate() {}

let files: string[] = [];
const diagnosticCollection = vscode.languages.createDiagnosticCollection(extensionName);

async function validate() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor found.");
    return;
  }

  const result = await lint();

  // clear
  for (const file of files) {
    const uri = vscode.Uri.file(file);
    // diagnosticCollection.set(uri, []);
  }
  files = [];

  for (const [filePath, diagnostics] of Object.entries(result)) {
    files.push(filePath);
    const uri = vscode.Uri.file(filePath);
    diagnosticCollection.set(uri, diagnostics);
  }
}

type SchemaLinterError = {
  message: string;
  location: {
    line: number;
    column: number;
    file: string;
  };
  rule: string;
};

type LintResult = Record<string, vscode.Diagnostic[]>;

async function lint(): Promise<LintResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage("No active text editor found.");
    return {};
  }

  const document = editor.document;
  const graphqlSchemaLinterPath = await findExecutable("graphql-schema-linter", document.fileName);

  if (!graphqlSchemaLinterPath) {
    vscode.window.showErrorMessage("graphql-schema-linter not found in node_modules.");
    return {};
  }

  const cmd = `${graphqlSchemaLinterPath} --format json`;
  const cwd = path.join(graphqlSchemaLinterPath, "..", "..", "..");
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      if (err === null) {
        return resolve({});
      }

      let errors: SchemaLinterError[];
      try {
        errors = JSON.parse(stdout).errors;
      } catch (err) {
        vscode.window.showErrorMessage((err as Error).toString());
        return resolve({});
      }

      const result: LintResult = {};
      errors.forEach((error) => {
        const { message, location, rule } = error;
        const { line, column, file } = location;

        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(line - 1, column - 1, line - 1, column - 1),
          message,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.code = rule;

        if (!result[file]) {
          result[file] = [];
        }

        result[file].push(diagnostic);
      });

      resolve(result);
    });
  });
}

async function findExecutable(executableName: string, filePath: string): Promise<string | null> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
  if (!workspaceFolder) {
    return null;
  }

  let currentPath = filePath;
  const rootPath = workspaceFolder.uri.fsPath;

  while (currentPath !== rootPath) {
    currentPath = path.dirname(currentPath);
    const nodeModulesPath = path.join(currentPath, "node_modules", ".bin", executableName);
    if (fs.existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
  }

  return null;
}

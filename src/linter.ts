import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";

type SchemaLinterError = {
  message: string;
  location: {
    line: number;
    column: number;
    file: string;
  };
  rule: string;
};

type LintResult = Map<vscode.Uri, vscode.Diagnostic[]>;

export async function runGraphqlSchemaLinter(document: vscode.TextDocument): Promise<LintResult> {
  const graphqlSchemaLinterPath = await findCommandPath(document);

  if (graphqlSchemaLinterPath === null) {
    throw new Error("graphql-schema-linter command not found.");
  }

  const cmd = `${graphqlSchemaLinterPath} --format json`;
  const cwd = path.join(graphqlSchemaLinterPath, "..", "..", "..");

  return new Promise<LintResult>((resolve, reject) => {
    exec(cmd, { cwd }, (err, stdout) => {
      if (err === null) {
        return resolve(new Map());
      }

      let errors: SchemaLinterError[];
      try {
        errors = JSON.parse(stdout).errors;
      } catch (err) {
        reject(err);
        return;
      }

      const result: LintResult = new Map();
      errors.forEach((error) => {
        const { message, location, rule } = error;
        const { line, column, file } = location;

        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(line - 1, column - 1, line - 1, column - 1),
          message,
          vscode.DiagnosticSeverity.Error
        );
        diagnostic.code = rule;

        const uri = vscode.Uri.file(file);
        result.set(uri, (result.get(uri) || []).concat(diagnostic));
      });
      resolve(result);
    });
  });
}

// Find executable graphql-schema-linter command in node_modules/.bin.
async function findCommandPath(document: vscode.TextDocument): Promise<string | null> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(document.fileName));
  if (!workspaceFolder) {
    return null;
  }

  let currentPath = document.fileName;
  const rootPath = workspaceFolder.uri.fsPath;

  while (currentPath !== rootPath) {
    currentPath = path.dirname(currentPath);
    const nodeModulesPath = path.join(currentPath, "node_modules", ".bin", "graphql-schema-linter");
    if (fs.existsSync(nodeModulesPath)) {
      return nodeModulesPath;
    }
  }

  return null;
}

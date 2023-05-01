import vscode from "vscode";
import type { LintResult } from "./linter";
import { runGraphqlSchemaLinter } from "./linter";

const extensionName = "vscode-graphql-schema-linter";
const DEBUG_MODE = process.env.DEBUG_MODE === "true";

type Context = {
  diagnosticCollection: vscode.DiagnosticCollection;
  diagnosedFileUris: Set<vscode.Uri>;
};

function isGraphQLDocument(document: vscode.TextDocument): boolean {
  return document.languageId === "graphql" || /\.(gql|graphqls?)$/.test(document.fileName);
}

export async function executeLint(document: vscode.TextDocument, context: Context) {
  if (isGraphQLDocument(document) === false) {
    return;
  }

  const lintResult = await runGraphqlSchemaLinter(document).catch((err) => {
    if (DEBUG_MODE) {
      console.error(err.message);
    }
    return new Map() as LintResult;
  });

  // Clear diagnostics for files that are not in the lintResult.
  for (const uri of context.diagnosedFileUris) {
    context.diagnosticCollection.delete(uri);
  }
  context.diagnosedFileUris = new Set();

  // Set diagnostics for files that are in the lintResult.
  for (const [filePath, diagnostics] of lintResult) {
    const uri = vscode.Uri.file(filePath);
    context.diagnosedFileUris.add(uri);
    context.diagnosticCollection.set(uri, diagnostics);
  }
}

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection(extensionName);

  const ctx: Context = {
    diagnosticCollection,
    diagnosedFileUris: new Set(),
  };

  const disposable = vscode.commands.registerCommand(`${extensionName}.executeLint`, () => {
    const document = vscode.window.activeTextEditor?.document;
    if (document) {
      executeLint(document, ctx);
    }
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(diagnosticCollection);

  vscode.workspace.textDocuments.forEach((document) => {
    executeLint(document, ctx);
  });

  vscode.workspace.onDidSaveTextDocument((document) => {
    executeLint(document, ctx);
  });

  vscode.workspace.onDidOpenTextDocument((document) => {
    executeLint(document, ctx);
  });
}

export function deactivate() {
  // do nothing
}

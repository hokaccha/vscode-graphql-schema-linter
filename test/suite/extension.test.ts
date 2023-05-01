import assert from "assert";
import vscode from "vscode";
import { executeLint } from "../../src/extension";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Start all tests.");

  test("executeLint", async () => {
    const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!rootPath) {
      throw new Error("rootPath is undefined");
    }
    const doc = await vscode.workspace.openTextDocument(`${rootPath}/schema/post.graphqls`);
    await executeLint(doc, {
      diagnosticCollection: vscode.languages.createDiagnosticCollection("test-graphql-schema-linter"),
      diagnosedFileUris: new Set(),
    });
    const diagnostics = vscode.languages.getDiagnostics(doc.uri);
    assert.strictEqual(diagnostics.length, 2);
  });
});

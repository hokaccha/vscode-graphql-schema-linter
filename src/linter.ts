import fs from "fs";
import path from "path";
import vscode from "vscode";

type SchemaLinterError = {
  message: string;
  location: {
    line: number;
    column: number;
    file: string;
  };
  rule: string;
};

// Map<filePath, vscode.Diagnostic[]>
export type LintResult = Map<string, vscode.Diagnostic[]>;

export async function runGraphqlSchemaLinter(document: vscode.TextDocument): Promise<LintResult> {
  const graphqlSchemaLinterPath = await findLibraryPath(document);

  if (graphqlSchemaLinterPath === null) {
    throw new Error("graphql-schema-linter is not installed.");
  }

  const cwd = path.join(graphqlSchemaLinterPath, "..", "..");
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runner } = require(graphqlSchemaLinterPath);
  const stdout = createStdio();
  const stderr = createStdio();
  const stdin = null;
  const argv = ["node", "_", "--format", "json", "--config-directory", cwd];
  const exitCode = await runner.run(stdout, stdin, stderr, argv);

  if (exitCode === 0) {
    return new Map();
  }

  if (exitCode !== 1) {
    throw new Error(stderr.data || "graphql-schema-linter failed.");
  }

  const errors: SchemaLinterError[] = JSON.parse(stdout.data).errors;
  const result: LintResult = new Map();

  errors.forEach((error) => {
    const { message, location, rule } = error;
    const { line, column, file: filePath } = location;

    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(line - 1, column - 1, line - 1, column - 1),
      message,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.source = "graphql-schema-linter";
    diagnostic.code = rule;

    result.set(filePath, (result.get(filePath) || []).concat(diagnostic));
  });

  return result;
}

// Find graphql-schema-linter library in node_modules
async function findLibraryPath(document: vscode.TextDocument): Promise<string | null> {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(document.fileName));
  if (!workspaceFolder) {
    return null;
  }

  let currentPath = document.fileName;
  const rootPath = workspaceFolder.uri.fsPath;

  while (currentPath !== rootPath) {
    currentPath = path.dirname(currentPath);
    const libPath = path.join(currentPath, "node_modules", "graphql-schema-linter");
    if (fs.existsSync(libPath)) {
      return libPath;
    }
  }

  return null;
}

function createStdio() {
  return {
    data: "",
    write(_data: string) {
      this.data = _data;
      return true;
    },
    on(_: string, cb: () => void) {
      cb();
    },
  };
}

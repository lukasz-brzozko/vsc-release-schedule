import * as vscode from "vscode";
import moment from "moment";

export function activate(context: vscode.ExtensionContext) {
  const myTreeDataProvider = new MyTreeDataProvider();
  vscode.window.registerTreeDataProvider("myTreeView", myTreeDataProvider);

  let disposable = vscode.commands.registerCommand(
    "extension.showTreeView",
    () => {
      vscode.window.showInformationMessage(
        "Tree View is now visible in the Explorer view."
      );
    }
  );

  context.subscriptions.push(disposable);

  vscode.commands.registerCommand("myTreeView.moveUp", (item: TreeItem) => {
    const index = myTreeDataProvider.items.indexOf(item);
    if (index > 0) {
      myTreeDataProvider.moveItem(index, index - 1);
      updateDates();
    }
  });

  vscode.commands.registerCommand("myTreeView.moveDown", (item: TreeItem) => {
    const index = myTreeDataProvider.items.indexOf(item);
    if (index < myTreeDataProvider.items.length - 1) {
      myTreeDataProvider.moveItem(index, index + 1);
      updateDates();
    }
  });

  vscode.commands.registerCommand(
    "myTreeView.toggleChecked",
    (item: TreeItem) => {
      myTreeDataProvider.toggleItemChecked(item);
      updateDates();
    }
  );

  vscode.commands.registerCommand("extension.generateJSON", () => {
    const data = myTreeDataProvider.items
      .filter((item) => item.checked)
      .map((item) => ({
        label: item.label,
        checked: item.checked,
        nextMonday: item.nextMonday
          ? item.nextMonday.format("DD-MM-YYYY")
          : null,
      }));

    const jsonContent = JSON.stringify(data, null, 2);
    vscode.workspace.fs.writeFile(
      vscode.Uri.file("selectedItems.json"),
      Buffer.from(jsonContent, "utf-8")
    );

    vscode.window.showInformationMessage("JSON file generated successfully.");
  });

  function updateDates() {
    let startDate = moment().startOf("isoWeek").add(1, "week"); // Start from next Monday
    let nextValidMonday = startDate.clone(); // Initialize the next valid Monday

    myTreeDataProvider.items.forEach((item) => {
      if (item.checked) {
        item.nextMonday = nextValidMonday.clone();
        item.updateNextMonday();
        nextValidMonday.add(1, "week"); // Move to the next Monday for the next item
      } else {
        item.nextMonday = null;
        item.updateNextMonday();
      }
    });
  }
}

class TreeItem extends vscode.TreeItem {
  public nextMonday: moment.Moment | null = null;

  constructor(
    public readonly originalLabel: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly index: number,
    public checked: boolean = true,
    public readonly command?: vscode.Command
  ) {
    super(originalLabel, collapsibleState);
    this.contextValue = "treeItem";
    this.updateNextMonday();
  }

  toggleChecked() {
    this.checked = !this.checked;
    this.updateNextMonday();
  }

  updateNextMonday() {
    if (this.checked && this.nextMonday === null) {
      let startDate = moment().startOf("isoWeek").add(1, "week"); // Start from next Monday
      this.nextMonday = startDate.clone().add(this.index, "week");
    } else if (!this.checked) {
      this.nextMonday = null;
    }

    this.tooltip = this.nextMonday
      ? `Next Monday: ${this.nextMonday.format("DD-MM-YYYY")}`
      : "Not checked";
    this.iconPath = this.checked
      ? new vscode.ThemeIcon("check")
      : new vscode.ThemeIcon("circle-outline");

    if (this.checked && this.nextMonday) {
      this.label = `${this.originalLabel} (${this.nextMonday.format(
        "DD-MM-YYYY"
      )})`;
    } else {
      this.label = this.originalLabel;
    }
  }
}

class MyTreeDataProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<
    TreeItem | undefined | null | void
  > = new vscode.EventEmitter<TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<
    TreeItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  public items: TreeItem[] = [
    new TreeItem("Item 1", vscode.TreeItemCollapsibleState.None, 0),
    new TreeItem("Item 2", vscode.TreeItemCollapsibleState.None, 1),
    new TreeItem("Item 3", vscode.TreeItemCollapsibleState.None, 2),
    new TreeItem("Item 4", vscode.TreeItemCollapsibleState.None, 3),
  ];

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): Thenable<TreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    } else {
      return Promise.resolve(this.items);
    }
  }

  moveItem(fromIndex: number, toIndex: number) {
    const item = this.items.splice(fromIndex, 1)[0];
    this.items.splice(toIndex, 0, item);
    this._onDidChangeTreeData.fire();
  }

  toggleItemChecked(item: TreeItem) {
    item.toggleChecked();
    this._onDidChangeTreeData.fire();
  }
}

export function deactivate() {}

import * as vscode from "vscode";
import moment from "moment";

let userStartDate: moment.Moment | null = null; // Track the user-selected date

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
      updateDates(userStartDate); // Use the user-selected date if available
    }
  });

  vscode.commands.registerCommand("myTreeView.moveDown", (item: TreeItem) => {
    const index = myTreeDataProvider.items.indexOf(item);
    if (index < myTreeDataProvider.items.length - 1) {
      myTreeDataProvider.moveItem(index, index + 1);
      updateDates(userStartDate); // Use the user-selected date if available
    }
  });

  vscode.commands.registerCommand(
    "myTreeView.toggleChecked",
    (item: TreeItem) => {
      myTreeDataProvider.toggleItemChecked(item);
      updateDates(userStartDate); // Use the user-selected date if available
    }
  );

  vscode.commands.registerCommand("extension.generateReminderFile", () => {
    const data = myTreeDataProvider.items
      .filter((item) => item.checked)
      .map((item) => ({
        label: item.label,
        nextMonday: item.nextMonday
          ? item.nextMonday.format("DD.MM.YYYY")
          : null,
      }));

    const fileContent = data
      .map(
        (item) =>
          `/remind #b2b-front "W tym tygodniu podgrywa @${item.label
            ?.toString()
            .match(/^([\w\s]\w+)+/g)}" every ${data.length} weeks starting ${
            item.nextMonday
          } at 9:00AM`
      )
      .join("\n");

    const filePath = vscode.Uri.parse("untitled:reminders.txt");
    vscode.workspace.openTextDocument(filePath).then((document) => {
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        filePath,
        new vscode.Range(
          document.lineAt(0).range.start,
          document.lineAt(document.lineCount - 1).range.end
        ),
        fileContent
      );
      return vscode.workspace.applyEdit(edit).then((success) => {
        if (success) {
          vscode.window.showTextDocument(document);
        } else {
          vscode.window.showInformationMessage(
            "Error generating reminders file"
          );
        }
      });
    });
  });

  vscode.commands.registerCommand("extension.pickDate", async () => {
    const input = await vscode.window.showInputBox({
      placeHolder: "Enter a date (DD.MM.YYYY)",
      validateInput: (text) => {
        return moment(text, "DD.MM.YYYY", true).isValid()
          ? null
          : "Invalid date format. Use DD.MM.YYYY.";
      },
    });

    if (input) {
      userStartDate = moment(input, "DD.MM.YYYY");
      if (userStartDate.isValid()) {
        updateDates(userStartDate);
      } else {
        vscode.window.showErrorMessage(
          "Invalid date. Please enter a valid date in the format DD.MM.YYYY."
        );
      }
    }
  });

  function updateDates(startDate?: moment.Moment | null) {
    if (!startDate) {
      startDate = moment().startOf("isoWeek").add(1, "week"); // Default to next Monday
    }
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

    myTreeDataProvider.refresh();
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
      ? `Next Monday: ${this.nextMonday.format("DD.MM.YYYY")}`
      : "Not checked";
    this.iconPath = this.checked
      ? new vscode.ThemeIcon("check")
      : new vscode.ThemeIcon("circle-outline");

    if (this.checked && this.nextMonday) {
      this.label = `${this.originalLabel} (${this.nextMonday.format(
        "DD.MM.YYYY"
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

  refresh() {
    this._onDidChangeTreeData.fire();
  }
}

export function deactivate() {}

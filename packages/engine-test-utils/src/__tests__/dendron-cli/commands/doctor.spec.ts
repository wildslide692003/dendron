import { WorkspaceOpts } from "@dendronhq/common-all";
import { file2Note } from "@dendronhq/common-server";
import { AssertUtils, NoteTestUtilsV4 } from "@dendronhq/common-test-utils";
import {
  DoctorActions,
  DoctorCLICommand,
  DoctorCLICommandOpts,
} from "@dendronhq/dendron-cli";
import path from "path";
import fs from "fs-extra";
import { createEngineFromServer, runEngineTestV5 } from "../../../engine";
import _ from "lodash";

const setupBasic = async (opts: WorkspaceOpts) => {
  const { wsRoot, vaults } = opts;
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "foo",
    body: [`# Foo Header`, `## Foo Content`].join("\n"),
  });
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "bar",
    body: [`# Bar Header`, `## Bar Content`].join("\n"),
  });
};

const setupWithWikilink = async (opts: WorkspaceOpts) => {
  const { wsRoot, vaults } = opts;
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "foo",
    body: "[[foo.bar]]\n",
  });
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "foo.bar",
    body: "[[fake.link]]\n",
  });
};

const setupMultiWithWikilink = async (opts: WorkspaceOpts) => {
  const { wsRoot, vaults } = opts;
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "foo",
    body: "[[foo.bar]]\n",
  });
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "foo.bar",
    body: "[[fake.link]]\n",
  });
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[1],
    fname: "baz",
    body: "[[baz.qaaz]]\n",
  });
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[1],
    fname: "baz.qaaz",
    body: "[[fake]]\n",
  });
};

const setupWithAliasedWikilink = async (opts: WorkspaceOpts) => {
  const { wsRoot, vaults } = opts;
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "foo",
    body: ["[[foo bar|foo.bar]]", "[[foobaz|foo.baz]]"].join("\n"),
  });
};

const setupWithXVaultWikilink = async (opts: WorkspaceOpts) => {
  const { wsRoot, vaults } = opts;
  await NoteTestUtilsV4.createNote({
    wsRoot,
    vault: vaults[0],
    fname: "foo",
    body: [
      "[[dendron://vault2/bar]]",
      "[[baz|dendron://vault2/baz]]",
      "[[qaaaz note|dendron://vault2/qaaaz]]",
    ].join("\n"),
  });
};

const runDoctor = (opts: Omit<DoctorCLICommandOpts, "server">) => {
  const cmd = new DoctorCLICommand();
  return cmd.execute({
    exit: false,
    ...opts,
    server: {} as any,
  });
};

describe(DoctorActions.HI_TO_H2, () => {
  const action = DoctorActions.HI_TO_H2;

  test("basic", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        await runDoctor({
          wsRoot,
          engine,
          action,
        });
        const names = ["Foo", "Bar"];
        await Promise.all(
          names.map(async (nm) => {
            const fpath = path.join(
              wsRoot,
              vault.fsPath,
              `${nm.toLowerCase()}.md`
            );
            const note = file2Note(fpath, vault);
            expect(note).toMatchSnapshot();
            expect(
              await AssertUtils.assertInString({
                body: note.body,
                match: [`## ${nm} Header`],
              })
            ).toBeTruthy();
          })
        );
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupBasic,
      }
    );
  });

  test("basic pass candidates opt", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        const resp = await engine.getNoteByPath({
          npath: "foo",
          createIfNew: false,
          vault,
        });
        const fooFile = resp.data!.note;
        await runDoctor({
          candidates: [fooFile!],
          wsRoot,
          engine,
          action,
        });

        const fpathFoo = path.join(wsRoot, vault.fsPath, "foo.md");
        const noteFoo = file2Note(fpathFoo, vault);
        expect(noteFoo).toMatchSnapshot();
        expect(
          await AssertUtils.assertInString({
            body: noteFoo.body,
            match: [`## Foo Header`],
          })
        ).toBeTruthy();

        // bar.md should be untouched.
        const fpathBar = path.join(wsRoot, vault.fsPath, "bar.md");
        const note = file2Note(fpathBar, vault);
        expect(note).toMatchSnapshot();
        expect(
          await AssertUtils.assertInString({
            body: note.body,
            match: [`# Bar Header`],
          })
        ).toBeTruthy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupBasic,
      }
    );
  });

  test("dry run", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        await runDoctor({
          wsRoot,
          engine,
          action,
          dryRun: true,
        });
        const names = ["Foo", "Bar"];
        await Promise.all(
          names.map(async (nm) => {
            const fpath = path.join(
              wsRoot,
              vault.fsPath,
              `${nm.toLowerCase()}.md`
            );
            const note = file2Note(fpath, vault);
            expect(note).toMatchSnapshot();
            expect(
              await AssertUtils.assertInString({
                body: note.body,
                nomatch: [`## ${nm} Header`],
              })
            ).toBeTruthy();
          })
        );
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupBasic,
      }
    );
  });
});

describe("H1_TO_TITLE", () => {
  const action = DoctorActions.H1_TO_TITLE;
  test("basic", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        await runDoctor({
          wsRoot,
          engine,
          action,
        });
        const names = ["Foo", "Bar"];
        await Promise.all(
          names.map(async (nm) => {
            const fpath = path.join(
              wsRoot,
              vault.fsPath,
              `${nm.toLowerCase()}.md`
            );
            const note = file2Note(fpath, vault);
            expect(note).toMatchSnapshot();
            expect(note.title).toEqual(`${nm} Header`);
          })
        );
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupBasic,
      }
    );
  });

  test("basic pass candidates opts", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        const resp = await engine.getNoteByPath({
          npath: "foo",
          createIfNew: false,
          vault,
        });
        const fooFile = resp.data!.note;
        await runDoctor({
          candidates: [fooFile!],
          wsRoot,
          engine,
          action,
        });
        const fpathFoo = path.join(wsRoot, vault.fsPath, "foo.md");
        const noteFoo = file2Note(fpathFoo, vault);
        expect(noteFoo).toMatchSnapshot();
        expect(noteFoo.title).toEqual("Foo Header");

        const fpathBar = path.join(wsRoot, vault.fsPath, "bar.md");
        const noteBar = file2Note(fpathBar, vault);
        expect(noteBar).toMatchSnapshot();
        expect(noteBar.title).toEqual("Bar");
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupBasic,
      }
    );
  });
});

describe("CREATE_MISSING_LINKED_NOTES", () => {
  const action = DoctorActions.CREATE_MISSING_LINKED_NOTES;
  // skip this until we enable workspace scope
  test.skip("basic", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        await runDoctor({
          wsRoot,
          engine,
          action,
        });
        const fileExists = await fs.pathExists(
          path.join(wsRoot, vault.fsPath, "fake.link.md")
        );
        expect(fileExists).toBeTruthy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithWikilink,
      }
    );
  });

  test("basic workspace scope should do nothing", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        await runDoctor({
          wsRoot,
          engine,
          action,
        });
        const fileExists = await fs.pathExists(
          path.join(wsRoot, vault.fsPath, "fake.link.md")
        );
        expect(fileExists).toBeFalsy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithWikilink,
      }
    );
  });

  test("basic pass candidates opts", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        const resp = await engine.getNoteByPath({
          npath: "foo",
          createIfNew: false,
          vault,
        });
        const fooFile = resp.data!.note;
        await runDoctor({
          candidates: [fooFile!],
          wsRoot,
          engine,
          action,
        });
        engine;
        const fileExists = await fs.pathExists(
          path.join(wsRoot, vault.fsPath, "fake.link.md")
        );
        expect(fileExists).toBeFalsy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithWikilink,
      }
    );
  });

  // skip this until we enable workspace scope
  test.skip("dry run", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        await runDoctor({
          wsRoot,
          engine,
          action,
          dryRun: true,
        });
        const fileExists = await fs.pathExists(
          path.join(wsRoot, vault.fsPath, "fake.link.md")
        );
        expect(fileExists).toBeFalsy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithWikilink,
      }
    );
  });

  test("dry run", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        const resp = await engine.getNoteByPath({
          npath: "foo",
          createIfNew: false,
          vault,
        });
        const fooFile = resp.data!.note;
        await runDoctor({
          candidates: [fooFile!],
          wsRoot,
          engine,
          action,
          dryRun: true,
        });
        const fileExists = await fs.pathExists(
          path.join(wsRoot, vault.fsPath, "fake.link.md")
        );
        expect(fileExists).toBeFalsy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithWikilink,
      }
    );
  });

  // skip this until we enable workspace scope
  test.skip("wild link with alias", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        await runDoctor({
          wsRoot,
          engine,
          action,
        });
        const fileNames = ["foo.bar.md", "foo.baz.md"];
        _.forEach(fileNames, async (fileName) => {
          const fileExists = await fs.pathExists(
            path.join(wsRoot, vault.fsPath, fileName)
          );
          expect(fileExists).toBeTruthy();
        });
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithAliasedWikilink,
      }
    );
  });

  test("wild link with alias pass candidates opts", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault = vaults[0];
        const resp = await engine.getNoteByPath({
          npath: "foo",
          createIfNew: false,
          vault,
        });
        const fooFile = resp.data!.note;
        await runDoctor({
          candidates: [fooFile!],
          wsRoot,
          engine,
          action,
        });
        const fileExists = await fs.pathExists(
          path.join(wsRoot, vault.fsPath, "foo.bar.md")
        );
        expect(fileExists).toBeTruthy();
        const fileDoesntExist = await fs.pathExists(
          path.join(wsRoot, vault.fsPath, "foo.baz.md")
        );
        expect(fileDoesntExist).toBeTruthy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithAliasedWikilink,
      }
    );
  });

  // skipping this until we enable workspace scope.
  test.skip("missing notes in multiple vaults", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault1 = vaults[0];
        const vault2 = vaults[1];
        await runDoctor({
          wsRoot,
          engine,
          action,
        });
        const fileExistsVault1 = await fs.pathExists(
          path.join(wsRoot, vault1.fsPath, "fake.link.md")
        );
        expect(fileExistsVault1).toBeTruthy();
        const fileExistsVault2 = await fs.pathExists(
          path.join(wsRoot, vault2.fsPath, "fake.md")
        );
        expect(fileExistsVault2).toBeTruthy();
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupMultiWithWikilink,
      }
    );
  });

  // skipping this until we enable workspace scope.
  test.skip("xvaults wild links", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault1 = vaults[0];
        const vault2 = vaults[1];
        await runDoctor({
          wsRoot,
          engine,
          action,
        });
        const fileExistsVault1 = await fs.pathExists(
          path.join(wsRoot, vault1.fsPath, "bar.md")
        );
        expect(fileExistsVault1).toBeFalsy();
        const fileNames = ["bar.md", "baz.md", "qaaaz.md"];
        _.forEach(fileNames, async (fileName) => {
          const fileExistsVault2 = await fs.pathExists(
            path.join(wsRoot, vault2.fsPath, fileName)
          );
          expect(fileExistsVault2).toBeTruthy();
        });
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithXVaultWikilink,
      }
    );
  });

  test("xvaults wild links pass candidates opts", async () => {
    await runEngineTestV5(
      async ({ engine, wsRoot, vaults }) => {
        const vault1 = vaults[0];
        const vault2 = vaults[1];
        await NoteTestUtilsV4.createNote({
          wsRoot,
          vault: vault1,
          fname: "foo2",
          body: [
            "[[dendron://vault2/bar2]]",
            "[[baz|dendron://vault2/baz2]]",
            "[[qaaaz note|dendron://vault2/qaaaz2]]",
          ].join("\n"),
        });
        const resp = await engine.getNoteByPath({
          npath: "foo",
          createIfNew: false,
          vault: vault1,
        });
        const fooFile = resp.data!.note;
        await runDoctor({
          candidates: [fooFile!],
          wsRoot,
          engine,
          action,
        });
        const fileExistsVault1 = await fs.pathExists(
          path.join(wsRoot, vault1.fsPath, "bar.md")
        );
        expect(fileExistsVault1).toBeFalsy();
        const fileNames = ["bar.md", "baz.md", "qaaaz.md"];
        _.forEach(fileNames, async (fileName) => {
          const fileExistsVault2 = await fs.pathExists(
            path.join(wsRoot, vault2.fsPath, fileName)
          );
          expect(fileExistsVault2).toBeTruthy();
        });
        const fileNames2 = ["bar2.md", "baz2.md", "qaaaz2.md"];
        _.forEach(fileNames2, async (fileName) => {
          const fileExistsVault2 = await fs.pathExists(
            path.join(wsRoot, vault2.fsPath, fileName)
          );
          expect(fileExistsVault2).toBeFalsy();
        });
      },
      {
        createEngine: createEngineFromServer,
        expect,
        preSetupHook: setupWithXVaultWikilink,
      }
    );
  });
});

type LatticeStorageModule = {
  listLatticeWorkspaces(input: { projectDir: string }): Promise<unknown>;
  createLatticeWorkspace(input: {
    projectDir: string;
    title?: string;
    origin: "blank" | "conversation";
  }): Promise<unknown>;
  readLatticeState(input: {
    projectDir: string;
    workspaceId?: string;
  }): Promise<unknown>;
  applyLatticePatch(input: {
    projectDir: string;
    workspaceId?: string;
    expectedRevision: number;
    patch: Record<string, unknown>;
  }): Promise<unknown>;
  saveLatticeUiState(input: {
    projectDir: string;
    workspaceId?: string;
    uiState: Record<string, unknown>;
  }): Promise<unknown>;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function loadStorageModule(): Promise<LatticeStorageModule> {
  const moduleUrl = new URL(
    "../../../plugins/lattice/mcp/lib/storage.mjs",
    import.meta.url,
  );
  const candidate = await import(moduleUrl.href) as Partial<LatticeStorageModule>;
  if (
    typeof candidate.readLatticeState !== "function" ||
    typeof candidate.applyLatticePatch !== "function" ||
    typeof candidate.saveLatticeUiState !== "function" ||
    typeof candidate.listLatticeWorkspaces !== "function" ||
    typeof candidate.createLatticeWorkspace !== "function"
  ) {
    throw new Error("The shared Lattice storage module is incomplete.");
  }
  return candidate as LatticeStorageModule;
}

export class LatticeProjectStorage {
  readonly projectDir: string;
  readonly workspaceId: string;

  #module: LatticeStorageModule;

  private constructor(
    projectDir: string,
    workspaceId: string,
    storageModule: LatticeStorageModule,
  ) {
    this.projectDir = projectDir;
    this.workspaceId = workspaceId;
    this.#module = storageModule;
  }

  static async open(
    projectDir: string,
    workspaceId?: string,
  ): Promise<LatticeProjectStorage> {
    const storageModule = await loadStorageModule();
    const initial = record(await storageModule.readLatticeState({ projectDir }));
    const canonicalProjectDir = initial?.projectDir;
    if (typeof canonicalProjectDir !== "string" || !canonicalProjectDir) {
      throw new Error("The shared Lattice storage module returned an invalid project.");
    }
    let selectedWorkspaceId = workspaceId;
    if (selectedWorkspaceId) {
      const selected = record(await storageModule.readLatticeState({
        projectDir: canonicalProjectDir,
        workspaceId: selectedWorkspaceId,
      }));
      if (selected?.workspaceId !== selectedWorkspaceId) {
        throw new Error(`Unknown Lattice workspace: ${selectedWorkspaceId}`);
      }
    } else {
      const created = record(await storageModule.createLatticeWorkspace({
        projectDir: canonicalProjectDir,
        title: "New research",
        origin: "blank",
      }));
      selectedWorkspaceId =
        typeof created?.workspaceId === "string"
          ? created.workspaceId
          : undefined;
      if (!selectedWorkspaceId) {
        throw new Error(
          "The shared Lattice storage module did not create a workspace.",
        );
      }
    }
    return new LatticeProjectStorage(
      canonicalProjectDir,
      selectedWorkspaceId,
      storageModule,
    );
  }

  list(): Promise<unknown> {
    return this.#module.listLatticeWorkspaces({
      projectDir: this.projectDir,
    });
  }

  create(input: {
    title?: string;
    origin?: "blank" | "conversation";
  }): Promise<unknown> {
    return this.#module.createLatticeWorkspace({
      projectDir: this.projectDir,
      ...(input.title ? { title: input.title } : {}),
      origin: input.origin ?? "blank",
    });
  }

  read(workspaceId = this.workspaceId): Promise<unknown> {
    return this.#module.readLatticeState({
      projectDir: this.projectDir,
      workspaceId,
    });
  }

  apply(
    expectedRevision: number,
    patch: Record<string, unknown>,
    workspaceId = this.workspaceId,
  ): Promise<unknown> {
    return this.#module.applyLatticePatch({
      projectDir: this.projectDir,
      workspaceId,
      expectedRevision,
      patch,
    });
  }

  saveUiState(
    uiState: Record<string, unknown>,
    workspaceId = this.workspaceId,
  ): Promise<unknown> {
    return this.#module.saveLatticeUiState({
      projectDir: this.projectDir,
      workspaceId,
      uiState,
    });
  }
}

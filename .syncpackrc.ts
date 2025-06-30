import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { globSync } from "glob";
import type { RcFile } from "syncpack";

// Can be overrided with `--source` flag.
// e.g., `--source "**/package.json"` to include `node_modules`.
const SOURCE_GLOBS = [
  "package.json",
  "apps/*/package.json",
  "packages/*/package.json",
];

type VersionGroup = NonNullable<RcFile["versionGroups"]>[number];

/* ────────────────────────────────────────────────────────────────── *
 * Collect every peerDependency declared by @next-eval, @wordbricks   *
 *    – but NEVER include any node_modules folder.                    *
 * ────────────────────────────────────────────────────────────────── */
const collectPeerDeps = (): string[] => {
  const peerDeps = new Set<string>();

  for (const pattern of SOURCE_GLOBS) {
    const files = globSync(resolve(__dirname, pattern), {
      absolute: true,
      nodir: true,
      ignore: ["**/node_modules/**"],
    });

    for (const file of files) {
      const pkg = JSON.parse(readFileSync(file, "utf8")) as {
        name?: string;
        peerDependencies?: Record<string, string>;
      };

      if (
        (pkg.name?.startsWith("@next-eval/") ||
          pkg.name?.startsWith("@wordbricks/")) &&
        pkg.peerDependencies
      ) {
        for (const d of Object.keys(pkg.peerDependencies)) {
          peerDeps.add(d);
        }
      }
    }
  }

  return [...peerDeps].sort();
};

const peerDepBanGroup: VersionGroup = {
  label: "Peer deps must not duplicated with deps/devDeps",
  dependencies: collectPeerDeps(),
  dependencyTypes: ["!peer"],
  packages: ["@next-eval/**", "@wordbricks/**"],
  isBanned: true,
};

// Will be ignored in `syncpack update --check`
const pinnedVersionGroup: VersionGroup[] = [].map((group: VersionGroup) => ({
  label: "Pinned versions",
  ...group,
}));

// Reference: https://github.com/badbatch/repodog/blob/main/configs/syncpack-config/index.cjs
export default {
  source: SOURCE_GLOBS,

  sortAz: [
    "bin",
    "contributors",
    "dependencies",
    "devDependencies",
    "keywords",
    "peerDependencies",
    "resolutions",
  ],

  sortFirst: [
    "name",
    "description",
    "version",
    "author",
    "license",
    "private",
    "homepage",
    "repository",
    "bugs",
    "type",
    "sideEffects",
    "engines",
    "bin",
    "main",
    "module",
    "types",
    "imports",
    "exports",
    "publishConfig",
    "scripts",
    "dependencies",
    "peerDependencies",
    "peerDependenciesMeta",
    "devDependencies",
  ],

  semverGroups: [
    {
      packages: ["@next-eval/ui"],
      isIgnored: true,
    },
    {
      packages: ["@wordbricks/next-eval"],
      dependencyTypes: ["!peer"],
      range: "^",
    },
    { dependencyTypes: ["!peer"], range: "" },
    {
      dependencyTypes: ["peer"],
      range: ">=",
    },
  ],

  // Higher order comes earlier
  versionGroups: [
    peerDepBanGroup,
    {
      label: "Use workspace protocol when developing local packages",
      dependencies: ["$LOCAL"],
      dependencyTypes: ["prod", "dev"],
      pinVersion: "workspace:*",
    },
    {
      dependencyTypes: ["peer"],
      preferVersion: "lowestSemver",
    },

    /* ─────────────────────────────────────── *
     * Pin versions to use stable one.         *
     * - Should come after peer deps setting,  *
     *   and before the other settings.        *
     * ─────────────────────────────────────── */
    ...pinnedVersionGroup,

    // Other version groups
  ],
} satisfies RcFile;

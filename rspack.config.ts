import path, { join, resolve, extname, dirname, relative } from 'path';
import { Compiler, Configuration, CssExtractRspackPlugin, RspackPluginInstance, WebpackPluginInstance } from "@rspack/core";
import "webpack-dev-server";
import { TransformOptions } from "esbuild";
import { parse } from "jsonc-parser";
import { readFile } from "fs/promises";
import { TsConfigJson } from "type-fest";
import { TsconfigPathsPlugin } from "tsconfig-paths-webpack-plugin";
import { Options } from "tsconfig-paths-webpack-plugin/lib/options";
import { ensureDirSync, exists, existsSync, mkdirSync, readdir, removeSync, writeFileSync, Dirent } from "fs-extra";
import crypto from "crypto";
import { exec, execSync } from "child_process";
import { promisify } from "util";


interface ENV {
    IS_DEV: boolean;
    IS_REPORTER: boolean;
}

export class RspackVirtualModulePlugin implements RspackPluginInstance {
    #staticModules: Record<string, string>;

    #tempDir: string;

    constructor(staticModules: Record<string, string>, tempDir?: string) {
        this.#staticModules = staticModules;
        const nodeModulesDir = join(process.cwd(), 'node_modules');
        if (!existsSync(nodeModulesDir)) {
            mkdirSync(nodeModulesDir);
        }

        if (!tempDir) {
            const hash = crypto
                .createHash('md5')
                .update(JSON.stringify(this.#staticModules))
                .digest('hex')
                .slice(0, 8);
            this.#tempDir = path.join(
                nodeModulesDir,
                `rspack-virtual-module-${hash}`,
            );
        } else {
            this.#tempDir = path.join(nodeModulesDir, tempDir);
        }
        if (!existsSync(this.#tempDir)) {
            mkdirSync(this.#tempDir);
        }
    }

    apply(compiler: Compiler) {
        // Write the modules to the disk
        for (const [path, content] of Object.entries(this.#staticModules)) {
            this.writeModule(path, content);
        }
        const originalResolveModulesDir = compiler.options.resolve.modules || [
            'node_modules',
        ];
        compiler.options.resolve.modules = [
            ...originalResolveModulesDir,
            this.#tempDir,
        ];
        compiler.options.resolve.alias = {
            ...compiler.options.resolve.alias,
            ...Object.keys(this.#staticModules).reduce(
                (acc, p) => {
                    acc[p] = this.#normalizePath(p);
                    return acc;
                },
                {} as Record<string, string>,
            ),
        };
        process.on('exit', this.clear.bind(this));
    }

    writeModule(path: string, content: string) {
        const normalizedPath = this.#normalizePath(path);
        ensureDirSync(dirname(normalizedPath));
        writeFileSync(normalizedPath, content);
    }

    clear() {
        removeSync(this.#tempDir);
    }

    #normalizePath(p: string) {
        const ext = extname(p);
        return join(this.#tempDir, ext ? p : `${p}.js`);
    }
}

export const gitHash = process.env.VENCORD_HASH || execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();

export function getPluginTarget(filePath: string) {
    const pathParts = filePath.split(/[/\\]/);
    if (/^index\.tsx?$/.test(pathParts.at(-1)!)) pathParts.pop();

    const identifier = pathParts.at(-1)!.replace(/\.tsx?$/, "");
    const identiferBits = identifier.split(".");
    return identiferBits.length === 1 ? null : identiferBits.at(-1);
}

const PluginDefinitionNameMatcher = /definePlugin\(\{\s*(["'])?name\1:\s*(["'`])(.+?)\2/;

export async function resolvePluginName(base: string, dirent: Dirent) {
    const fullPath = join(base, dirent.name);
    const content = dirent.isFile()
        ? await readFile(fullPath, "utf-8")
        : await (async () => {
            for (const file of ["index.ts", "index.tsx"]) {
                try {
                    return await readFile(join(fullPath, file), "utf-8");
                } catch {
                    continue;
                }
            }
            throw new Error(`Invalid plugin ${fullPath}: could not resolve entry point`);
        })();

    return PluginDefinitionNameMatcher.exec(content)?.[3]
        ?? (() => {
            throw new Error(`Invalid plugin ${fullPath}: must contain definePlugin call with simple string name property as first property`);
        })();
}
async function gitRemotePlugin() {
    let remote = process.env.VENCORD_REMOTE;
    if (!remote) {
        const res = await promisify(exec)("git remote get-url origin", { encoding: "utf-8" });
        remote = res.stdout.trim()
            .replace("https://github.com/", "")
            .replace("git@github.com:", "")
            .replace(/.git$/, "");
    }

    return `export default "${remote}"`;
}
export async function globPlugins(kind: "web" | "discordDesktop" | "vencordDesktop", { IS_DEV, IS_REPORTER }: ENV): Promise<string> {
    const pluginDirs = ["plugins/_api", "plugins/_core", "plugins", "userplugins"];
    let code = "";
    let pluginsCode = "\n";
    let metaCode = "\n";
    let excludedCode = "\n";
    let i = 0;
    for (const dir of pluginDirs) {
        const userPlugin = dir === "userplugins";

        const fullDir = `./src/${dir}`;
        if (!await exists(fullDir)) continue;
        const files = await readdir(fullDir, { withFileTypes: true });
        for (const file of files) {
            const fileName = file.name;
            if (fileName.startsWith("_") || fileName.startsWith(".")) continue;
            if (fileName === "index.ts") continue;

            const target = getPluginTarget(fileName);

            if (target && !IS_REPORTER) {
                const excluded =
                    (target === "dev" && !IS_DEV) ||
                    (target === "web" && kind === "discordDesktop") ||
                    (target === "desktop" && kind === "web") ||
                    (target === "discordDesktop" && kind !== "discordDesktop") ||
                    (target === "vencordDesktop" && kind !== "vencordDesktop");

                if (excluded) {
                    const name = await resolvePluginName(fullDir, file);
                    excludedCode += `${JSON.stringify(name)}:${JSON.stringify(target)},\n`;
                    continue;
                }
            }

            const folderName = `src/${dir}/${fileName}`.replace(/^src\/plugins\//, "");

            const mod = `p${i}`;
            code += `import ${mod} from "./${relative("node_modules/folder", join("src", dir))}/${fileName.replace(/\.tsx?$/, "")}";\n`;
            pluginsCode += `[${mod}.name]:${mod},\n`;
            metaCode += `[${mod}.name]:${JSON.stringify({ folderName, userPlugin })},\n`; // TODO: add excluded plugins to display in the UI?
            i++;
        }
    }
    code += `export default {${pluginsCode}};export const PluginMeta={${metaCode}};export const ExcludedPlugins={${excludedCode}};`;
    return code;
}
async function makeRendererConfig(env: ENV): Promise<Configuration> {
    const { IS_DEV } = env;
    return {
        entry: './src/Vencord.ts',
        mode: IS_DEV ? 'development' : 'production',
        output: {
            path: path.resolve(__dirname, 'dist2'),
        },
        devServer: {
            open: true,
            host: 'localhost',
        },
        plugins: [
            // Learn more about plugins from https://webpack.js.org/configuration/plugins/
            // new GitHashPlugin,
            new RspackVirtualModulePlugin({
                '~git-hash': `export default "${gitHash}"`,
                '~plugins': await globPlugins("vencordDesktop", env),
                '~git-remote': await gitRemotePlugin(),
            }),
            new CssExtractRspackPlugin(),
        ],
        resolve: {
            extensions: ['.tsx', '.ts', '.jsx', '.js', '...'],
            tsConfig: {
                configFile: resolve(__dirname, "tsconfig.json"),
            }

        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/i,
                    loader: 'esbuild-loader',
                    exclude: ['/node_modules/'],
                    options: {
                        target: ["esnext"]
                    } satisfies TransformOptions
                },
                {
                    test: /\.css/i,
                    use: [{
                        loader: "builtin:lightningcss-loader",
                        options: {
                            minify: true,
                        }
                    },
                        "raw-loader"],
                    resourceQuery: /managed/
                },
                {
                    test: /\.css$/i,
                    use: [CssExtractRspackPlugin.loader, {
                        loader: 'css-loader',
                        options: {
                            url: false,
                            module: false
                        }
                    }],
                },
            ],
        },
    };
}
export default async (): Promise<Configuration[]> => {
    const env = {
        IS_DEV: true,
        IS_REPORTER: false,
    } satisfies ENV;
    return Promise.all([makeRendererConfig(env)]);
};

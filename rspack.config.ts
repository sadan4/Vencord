import path, { join, resolve, extname, dirname, relative } from 'path';
import { Compiler, Configuration, CssExtractRspackPlugin, DefinePlugin, HotModuleReplacementPlugin, ProvidePlugin, RspackOptions, RspackPluginInstance, SwcJsMinimizerRspackPlugin } from "@rspack/core";
import "webpack-dev-server";
import { readFile } from "fs/promises";
import { ensureDirSync, exists, existsSync, mkdirSync, readdir, removeSync, writeFileSync, Dirent, stat, rm } from "fs-extra";
import crypto from "crypto";
import { exec, execSync } from "child_process";
import { promisify } from "util";
import { ManagedCssPlugin } from "./managed-css";
import { defineConfig } from "@rspack/cli";
import { Config } from "@swc/types";
import { RsdoctorRspackMultiplePlugin } from "@rsdoctor/rspack-plugin";
import { EsbuildPlugin } from "esbuild-loader";
import { Target } from "puppeteer-core";
import { TransformOptions } from "esbuild";
import CircularDepPlugin from "circular-dependency-plugin";
interface ENV {
    IS_WEB: boolean;
    IS_EXTENSION: boolean;
    IS_DISCORD_DESKTOP: boolean;
    IS_VESKTOP: boolean;
    IS_DEV: boolean;
    IS_REPORTER: boolean;
    IS_STANDALONE: boolean;
    IS_UPDATER_DISABLED: boolean;
    VERSION: string;
    BUILD_TIMESTAMP: number;
    GIT_HASH: string;
    PROCESS_PLATFORM: string;
    IS_USERSCRIPT: boolean;
    RSPACK_SERVE: boolean | undefined;
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
const nop = () => { };
class FileResolverPlugin implements RspackPluginInstance {
    PLUGIN_NAME = "FileUriResolverPlugin";
    apply(compiler: Compiler) {
        compiler.hooks.normalModuleFactory.tap(this.PLUGIN_NAME, (nmf) => {
            nmf.hooks.resolve.tap(this.PLUGIN_NAME, (data) => {
                if (data.request.startsWith("file://") && URL.canParse(data.request)) {
                    const url = new URL(data.request.replace("file://", "file://a/"));
                    const path = url.pathname.replace(/^\//, "");
                    // FIXME: excape with RegExp.escape
                    const ending = data.request.replace(new RegExp(`^file://.*${path}`), "");
                    const fullpath = join(data.context, path);
                    data.request = `${this.PLUGIN_NAME}!=!${fullpath}${ending}`;
                }
            });
        });
        compiler.options.module.rules.push(
            {
                resource: this.PLUGIN_NAME,
                type: "asset/source",
            }
        );
    };
}
function getRendererFileName({ IS_VESKTOP, IS_DISCORD_DESKTOP, IS_EXTENSION, IS_USERSCRIPT, IS_WEB }: ENV) {
    if (IS_VESKTOP) return 'vencordDesktopRenderer';
    if (IS_DISCORD_DESKTOP) return "renderer";
    if (IS_EXTENSION) return "extension";
    if (IS_USERSCRIPT) return "Vencord.user";
    if (IS_WEB) return "browser";
    throw new Error("Unknown target");
}
async function makeRendererConfig(env: ENV): Promise<Configuration> {
    const {
        IS_DEV,
        GIT_HASH,
        IS_VESKTOP,
        IS_DISCORD_DESKTOP,
        IS_EXTENSION,
        IS_WEB,
        IS_REPORTER,
        IS_UPDATER_DISABLED,
        IS_STANDALONE,
        VERSION,
        BUILD_TIMESTAMP,
        PROCESS_PLATFORM,
        RSPACK_SERVE
    } = env;
    return {
        entry: './src/Vencord.ts',
        mode: IS_DEV ? 'development' : 'production',
        output: {
            path: resolve(__dirname, 'dist'),
            library: "Vencord",
            filename: `${false ? "Server_" : ""}${getRendererFileName(env)}.js`,
            ...(RSPACK_SERVE ? {
                publicPath: "http://localhost:8080/"
            } : {})
        },
        plugins: [
            // Learn more about plugins from https://webpack.js.org/configuration/plugins/
            // new GitHashPlugin,
            new RspackVirtualModulePlugin({
                '~git-hash': `export default "${GIT_HASH}"`,
                '~plugins': await globPlugins("vencordDesktop", env),
                '~git-remote': await gitRemotePlugin(),
            }),
            new CssExtractRspackPlugin({
                filename: `${getRendererFileName(env)}.css`,
            }),
            new FileResolverPlugin(),
            new ManagedCssPlugin(),
            new RsdoctorRspackMultiplePlugin({
                supports: {
                    generateTileGraph: true
                },
            }),
            new ProvidePlugin({
                VencordCreateElement: resolve(__dirname, join("scripts", "build", "inject", "create.mjs")),
                VencordFragment: resolve(__dirname, join("scripts", "build", "inject", "fragment.mjs")),
            }),
            // new CircularDepPlugin({
            //     // exclude detection of files based on a RegExp
            //     exclude: /never.never/,
            //     // include specific files based on a RegExp
            //     include: /src|node_modules/,
            //     // add errors to webpack instead of warnings
            //     // allow import cycles that include an asyncronous import,
            //     // e.g. via import(/* webpackMode: "weak" */ './file.js')
            //     allowAsyncCycles: false,
            //     // set the current working directory for displaying module paths
            //     cwd: process.cwd(),
            // })
        ],
        resolve: {
            extensions: ['.tsx', '.ts', '.jsx', '.js', '...'],
            tsConfig: {
                configFile: resolve(__dirname, "tsconfig.json"),
            },
        },
        target: ["web", "es2022"],
        devServer: {
            hot: true,
            liveReload: false,
            port: 8080,
            host: "localhost",
            webSocketServer: "ws",
            allowedHosts: "all",
            devMiddleware: {
                writeToDisk: true
            },
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
                "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
            },
            client: {
                logging: "verbose",
                overlay: {
                    runtimeErrors: function (error) {
                        const allowed = [
                            "Sentry successfully disabled",
                            "ResizeObserver loop completed with undelivered notifications",
                            "You are being rate limited"
                        ];
                        if (allowed.some(e => error.message.includes(e))) {
                            return false;
                        }
                        return true;
                    },
                },
            },
        },
        optimization: {
            moduleIds: IS_DEV ? undefined : "natural",
            splitChunks: false,
            minimizer: [
                new EsbuildPlugin({
                    css: true,
                    target: "esnext",
                    define: Object.fromEntries(Object.entries({
                        IS_WEB,
                        IS_EXTENSION,
                        IS_STANDALONE,
                        IS_UPDATER_DISABLED,
                        IS_DEV,
                        IS_REPORTER,
                        IS_DISCORD_DESKTOP,
                        IS_VESKTOP,
                        VERSION: JSON.stringify(VERSION),
                        BUILD_TIMESTAMP,
                        ...(IS_WEB || IS_STANDALONE ? {} : {
                            ["process.platform"]: PROCESS_PLATFORM,
                        })
                    }).map(([k, v]) => [k, String(v)])),
                    legalComments: "none",
                    minify: true,
                    treeShaking: true,
                }),
            ]
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/i,
                    loader: 'esbuild-loader',
                    options: {
                        target: "esnext",
                        jsx: "transform",
                        jsxFactory: "VencordCreateElement.default",
                        jsxFragment: "VencordFragment.default",
                        define: Object.fromEntries(Object.entries({
                            IS_WEB,
                            IS_EXTENSION,
                            IS_STANDALONE,
                            IS_UPDATER_DISABLED,
                            IS_DEV,
                            IS_REPORTER,
                            IS_DISCORD_DESKTOP,
                            IS_VESKTOP,
                            VERSION: JSON.stringify(VERSION),
                            BUILD_TIMESTAMP,
                            ...(IS_WEB || IS_STANDALONE ? {} : {
                                ["process.platform"]: PROCESS_PLATFORM,
                            })
                        }).map(([k, v]) => [k, String(v)])),
                        treeShaking: true,
                    } satisfies TransformOptions
                },
                /* {
                    test: /\.tsx?$/i,
                    loader: 'builtin:swc-loader',
                    exclude: ['/node_modules/'],
                    options: {
                        jsc: {
                            transform: {
                                react: {
                                    runtime: "classic",
                                    pragma: "VencordCreateElement",
                                    pragmaFrag: "VencordFragment",
                                    importSource: "scripts/build/inject/react"
                                },
                                optimizer: {
                                    simplify: true,
                                    globals: {
                                        vars: Object.fromEntries(Object.entries({
                                            IS_WEB,
                                            IS_EXTENSION,
                                            IS_STANDALONE,
                                            IS_UPDATER_DISABLED,
                                            IS_DEV,
                                            IS_REPORTER,
                                            IS_DISCORD_DESKTOP,
                                            IS_VESKTOP,
                                            VERSION: JSON.stringify(VERSION),
                                            BUILD_TIMESTAMP,
                                            ...(IS_WEB || IS_STANDALONE ? {} : {
                                                ["process.platform"]: PROCESS_PLATFORM,
                                            })
                                        }).map(([k, v]) => [k, String(v)])),
                                    }
                                }
                            }
                        }
                    } satisfies Config
                } */,
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
function getGlobPluginTarget({ IS_WEB, IS_VESKTOP, IS_DISCORD_DESKTOP }: ENV) {
    if (IS_WEB) return "web";
    if (IS_DISCORD_DESKTOP) return "discordDesktop";
    if (IS_VESKTOP) return "vencordDesktop";
    throw new Error("Unknown target");
}
function makeRendererStub(env: ENV): RspackOptions {
    return {
        entry: resolve(__dirname, join("scripts", env.IS_VESKTOP ? "vesktopStub.js" : "desktopStub.js")),
        output: {
            path: resolve(__dirname, "dist"),
            filename: `${getRendererFileName(env)}.js`,
            publicPath: "",
        },
    };
}
export default defineConfig(async function (args, { watch, env: { RSPACK_SERVE } }): Promise<Configuration[] | Configuration> {
    const PackageJson = JSON.parse(await readFile(resolve(__dirname, "package.json"), "utf-8"));

    function isSet(prop: string): boolean {
        return (prop in args) && String(args[prop]) == 'true';
    }

    function getOr(prop: string, or: string): string {
        return (prop in args) ? String(args[prop]) : or;
    }

    const GIT_HASH = process.env.VENCORD_HASH || execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
    const env = {
        IS_DEV: RSPACK_SERVE || watch || isSet("dev"),
        IS_REPORTER: isSet("reporter"),
        IS_STANDALONE: isSet("standalone"),
        IS_UPDATER_DISABLED: isSet("disable-updater"),
        VERSION: PackageJson.version,
        GIT_HASH,
        PROCESS_PLATFORM: JSON.stringify(process.platform),
        IS_DISCORD_DESKTOP: false,
        IS_EXTENSION: false,
        IS_VESKTOP: false,
        IS_WEB: false,
        IS_USERSCRIPT: false,
        BUILD_TIMESTAMP: Math.floor(Number(process.env.SOURCE_DATE_EPOCH) || Date.now()),
        RSPACK_SERVE
    } satisfies ENV;
    // if (await exists(resolve(__dirname, "dist")) && (await stat(resolve(__dirname, "dist"))).isDirectory()) {
    // await rm(resolve(__dirname, "dist"), { recursive: true });
    // }
    return Promise.all([
        makeRendererConfig({
            ...env,
            IS_VESKTOP: true,
        }),
        makeRendererConfig({
            ...env,
            IS_DISCORD_DESKTOP: true
        }),
        // ...(RSPACK_SERVE ? [
        //     makeRendererStub({ ...env, IS_DISCORD_DESKTOP: true }),
        //     makeRendererStub({ ...env, IS_VESKTOP: true }),
        // ] : [])
    ]);
});

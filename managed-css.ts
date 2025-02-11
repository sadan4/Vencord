import { Compiler, LoaderContext, LoaderDefinitionFunction, RspackPluginInstance } from "@rspack/core";
import { resolve, relative } from "path";

// const __dirname = import.meta.dirname;

const makeManagedCss = (NAME, SOURCE) => {
    const name = JSON.stringify(NAME);
    const source = JSON.stringify(SOURCE);
    return `
(window.VencordStyles ??= new Map()).set(${name}, {
    name: ${name},
    source: ${source},
    classNames: {},
    dom: null,
});

export default ${name};
`;
};
export class ManagedCssPlugin implements RspackPluginInstance {
    static PLUGIN_NAME = ManagedCssPlugin.prototype.PLUGIN_NAME;
    PLUGIN_NAME = "ManagedCssPlugin";
    apply(compiler: Compiler) {
        const { PLUGIN_NAME } = this;
        compiler.hooks.normalModuleFactory.tap(PLUGIN_NAME, (nmf) => {
            nmf.hooks.resolve.tap(PLUGIN_NAME, (data) => {
                if (data.request.match(/\.css\?managed$/)) {
                    data.request = `${PLUGIN_NAME}!=!${data.request}`;
                }
            });
        });
        const lRes = compiler.options.resolveLoader;
        (lRes.modules ??= ["node_modules"]).push(resolve(__dirname));
        (lRes.extensions ??= []).push(".ts");
        compiler.options.module.rules.push({
            resource: PLUGIN_NAME,
            use: [
                // {
                //     loader: "builtin:lightningcss-loader",
                //     options: {
                //         minify: true
                //     }
                // },
                "managed-css"
            ]
        });
    }
}
const loader: LoaderDefinitionFunction = function (source, map, data) {
    return makeManagedCss(relative(__dirname, this.resourcePath), source);
};

export default function () {
    return loader.apply(this, arguments);
};

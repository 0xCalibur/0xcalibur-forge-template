import type {TaskArgs, TaskFunction, TaskMeta} from "../../types";
import path from "path";
import fs from "fs";
import {formatDecimals, getFolders} from "../utils";
import {input, confirm, number} from "@inquirer/prompts";
import select from "@inquirer/select";
import Handlebars from "handlebars";
import {$, Glob} from "bun";
import {ethers} from "ethers";
import chalk from "chalk";
import {rm} from "fs/promises";
import type {Tooling} from "../../tooling";

export const meta: TaskMeta = {
    name: "gen/gen",
    description: "Generate a script, interface, contract, test deployment",
    options: {},
    positionals: {
        name: "template",
        description: "Template to generate [script, interface, contract, test]",
        required: true,
    },
};

type BipsPercent = {
    bips: number;
    percent: number;
};

type NamedAddress = {
    name?: string;
    address: `0x${string}`;
};

enum CollateralType {
    ERC20 = "ERC20",
    ERC4626 = "ERC4626",
    UNISWAPV3_LP = "UNISWAPV3_LP",
}

type NetworkSelection = {
    chainId: number;
    enumName: string;
    name: string;
};

type ERC20Meta = {
    name: string;
    symbol: string;
    decimals: number;
};

enum PoolType {
    AMM,
    PEGGED,
    LOOSELY_PEGGED,
    BARELY_PEGGED,
}

let networks: {name: string; chainId: number}[] = [];
let tooling: Tooling;
let destinationFolders: string[] = [];

export const task: TaskFunction = async (taskArgs: TaskArgs, _tooling: Tooling) => {
    await $`bun run build`;

    tooling = _tooling;

    networks = Object.keys(tooling.config.networks).map((network) => ({
        name: network,
        chainId: tooling.config.networks[network].chainId,
    }));

    const srcFolder = path.join(tooling.config.foundry.src);
    const utilsFolder = path.join("utils");
    destinationFolders = [...(await getFolders(srcFolder)), ...(await getFolders(utilsFolder)), `${tooling.config.foundry.src}`];

    const glob = new Glob("*.s.sol");
    const scriptFiles = (await Array.fromAsync(glob.scan(tooling.config.foundry.script))).map((f) => {
        const name = path.basename(f).replace(".s.sol", "");
        return {
            name,
            value: name,
        };
    });

    taskArgs.template = (taskArgs.template as string[])[0] as string;

    switch (taskArgs.template) {
        case "script": {
            const scriptName = await input({message: "Script Name"});
            const filename = await input({message: "Filename", default: `${scriptName}.s.sol`});

            _writeTemplate("script", tooling.config.foundry.script, filename, {
                scriptName,
            });
            break;
        }
        case "interface": {
            const interfaceName = await input({message: "Interface Name"});
            const filename = await input({message: "Filename", default: `${interfaceName}.sol`});

            _writeTemplate("interface", `${tooling.config.foundry.src}/interfaces`, filename, {
                interfaceName,
            });
            break;
        }
        case "contract": {
            const contractName = await input({message: "Contract Name"});
            const filename = await input({message: "Filename", default: `${contractName}.sol`});
            const operatable = await confirm({message: "Operatable?", default: false});
            const destination = await _selectDestinationFolder();

            _writeTemplate("contract", destination, filename, {
                contractName,
                operatable,
            });
            break;
        }
        case "test": {
            const modes = [
                {
                    name: "Simple",
                    value: "simple",
                },
                {
                    name: "Multi (base test-contract + per-suite-test-contract)",
                    value: "multi",
                },
            ];

            const testName = await input({message: "Test Name"});
            const scriptName = await select({
                message: "Script",
                choices: [{name: "(None)", value: "(None)"}, ...scriptFiles],
                default: testName,
            });
            const mode = await select({
                message: "Type",
                choices: modes,
            });
            const network = await _selectNetwork();
            const blockNumber = await input({message: "Block", default: "latest"});
            const filename = await input({message: "Filename", default: `${testName}.t.sol`});

            let parameters: {[key: string]: any} = {};

            parameters.testName = testName;
            parameters.scriptName = scriptName;
            parameters.mode = mode;
            parameters.network = network;
            parameters.blockNumber = blockNumber;

            let templateName = parameters.mode === "simple" ? "test" : "test-multi";

            if (parameters.scriptName === "(None)") {
                parameters.scriptName = undefined;
            }

            if (parameters.scriptName) {
                const solidityCode = fs.readFileSync(`${tooling.config.foundry.script}/${parameters.scriptName}.s.sol`, "utf8");
                const regex = /function deploy\(\) public returns \((.*?)\)/;

                const matches = solidityCode.match(regex);

                if (matches && matches.length > 1) {
                    const returnValues = matches[1].trim();
                    parameters.deployVariables = returnValues.split(",").map((value) => value.trim());
                    parameters.deployReturnValues = returnValues.split(",").map((value) => value.trim().split(" ")[1]);
                }
            }

            if (parameters.blockNumber == "latest") {
                parameters.blockNumber = await tooling.getProvider().getBlockNumber();
                console.log(`Using Block: ${parameters.blockNumber}`);
            }

            parameters.blockNumber = parseInt(parameters.blockNumber);

            _writeTemplate(templateName, tooling.config.foundry.test, filename, parameters);
            break;
        }
        default:
            console.error(`Template ${taskArgs.template} does not exist`);
            process.exit(1);
    }
};

const _deploy = async (chainNameOrId: string | number, scriptName: string) => {
    const networkConfig =
        typeof chainNameOrId === "string"
            ? tooling.getNetworkConfigByName(chainNameOrId as string)
            : tooling.getNetworkConfigByChainId(chainNameOrId as number);

    const verifyFlag = !networkConfig.disableVerifyOnDeploy ? "--verify" : "";

    await $`forge clean`.nothrow();
    await $`bun task forge-deploy --broadcast ${verifyFlag} --network ${networkConfig.name} --script ${scriptName} --no-confirm`.nothrow();
};

const _writeTemplate = (templateName: string, destinationFolder: string, fileName: string, templateData: any): string => {
    const template = fs.readFileSync(`templates/${templateName}.hbs`, "utf8");

    const compiledTemplate = Handlebars.compile(template)(templateData);
    const file = `${destinationFolder}/${fileName}`;

    fs.writeFileSync(file, compiledTemplate);

    return file;
};

const _selectToken = async (label: string, networkName: string): Promise<NamedAddress & {meta: ERC20Meta}> => {
    const tokenNamedAddress = await _inputAddress(networkName, label);
    const info = await _getERC20Meta(tokenNamedAddress.address);
    _printERC20Info(info);
    return {...tokenNamedAddress, meta: info};
};

const _getERC20Meta = async (token: `0x${string}`): Promise<ERC20Meta> => {
    try {
        const asset = await tooling.getContractAt("IERC20", token);
        const assetName = await asset.name();
        const assetSymbol = await asset.symbol();

        return {
            name: assetName,
            symbol: assetSymbol,
            decimals: Number(await asset.decimals()),
        };
    } catch (e) {
        console.error(`Couldn't retrieve underlying asset information for ${token}`);
        console.error(e);
        process.exit(1);
    }
};

const _printERC20Info = async (info: ERC20Meta) => {
    console.log(chalk.gray(`${info.name} [${info.symbol}]`));
    console.log(chalk.gray(`Decimals: ${info.decimals}`));
};

const _selectCollateralType = async (): Promise<CollateralType> => {
    return await select({
        message: "Collateral Type",
        choices: [
            {name: "ERC20", value: CollateralType.ERC20},
            {name: "ERC4626", value: CollateralType.ERC4626},
            {name: "Uniswap V3 LP", value: CollateralType.UNISWAPV3_LP},
        ],
    });
};

const _inputAddress = async (networkName: string, message: string): Promise<NamedAddress> => {
    let address;
    let name;

    while (!address || !name) {
        const answer = await input({message: `${message} (name or 0x...)`, required: true});

        if (_isAddress(answer)) {
            address = answer as `0x${string}`;
            name = tooling.getLabelByAddress(networkName, address);
        } else {
            address = tooling.getAddressByLabel(networkName, answer);

            if (address) {
                name = answer;
            } else {
                console.log(chalk.yellow(`Address for ${address} not found`));
            }
        }
    }

    console.log(chalk.gray(`Address: ${address} ${name ? `(${name})` : ""}`));

    return {
        address: ethers.utils.getAddress(address) as `0x${string}`,
        name,
    };
};

const _inputAggregator = async (networkName: string, message: string): Promise<NamedAddress> => {
    const namedAddress = await _inputAddress(networkName, message);

    // use IAggregator to query the chainlink oracle
    const aggregator = await tooling.getContractAt("IAggregatorWithMeta", namedAddress.address);

    try {
        try {
            const name = await aggregator.description();
            console.log(chalk.gray(`Name: ${name}`));
        } catch (e) {}

        const decimals = await aggregator.decimals();
        console.log(chalk.gray(`Decimals: ${decimals}`));

        const latestRoundData = await aggregator.latestRoundData();
        const priceInUsd = Number(latestRoundData[1]) / 10 ** decimals;
        console.log(chalk.gray(`Price: ${priceInUsd} USD`));
    } catch (e) {
        console.error(`Couldn't retrieve aggregator information for ${namedAddress}`);
        console.error(e);
        process.exit(1);
    }

    return namedAddress;
};

const _inputBipsAsPercent = async (
    message: string
): Promise<{
    bips: number;
    percent: number;
}> => {
    const percent = Number(
        await input({
            message: `${message} [0...100]`,
            required: true,
            validate: (valueStr: string) => {
                const value = Number(valueStr);
                return value >= 0 && value <= 100;
            },
        })
    );

    // convert percent to bips and make sure it's an integer between 0 and 10000
    return {
        bips: Math.round(percent * 100),
        percent,
    };
};

const _selectDestinationFolder = async (root?: string, defaultFolder?: string) => {
    return await select({
        message: "Destination Folder",
        choices: destinationFolders
            .map((folder) => {
                if (!root || (root && folder.startsWith(root))) {
                    return {name: folder, value: folder};
                }

                return undefined;
            })
            .filter((folder) => folder !== undefined),
        default: defaultFolder,
    });
};

const _selectNetwork = async (): Promise<NetworkSelection> => {
    const network = await select({
        message: "Network",
        choices: networks.map((network) => ({
            name: network.name,
            value: {chainId: network.chainId, name: network.name},
        })),
    });

    const networkConfig = tooling.changeNetwork(network.name);

    return {
        ...network,
        enumName: `ChainId.${networkConfig.enumName}`,
    };
};

const _isAddress = (address: string): boolean => {
    try {
        ethers.utils.getAddress(address);
        return true;
    } catch (e) {
        return false;
    }
};

Handlebars.registerHelper("printAddress", (namedAddress: NamedAddress) => {
    return namedAddress.name ? new Handlebars.SafeString(`toolkit.getAddress("${namedAddress.name}")`) : namedAddress.address;
});

Handlebars.registerHelper("ifeq", function (this: any, arg1: any, arg2: any, options: Handlebars.HelperOptions) {
    return arg1 === arg2 ? options.fn(this) : options.inverse(this);
});

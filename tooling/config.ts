import "dotenv-defaults/config";
import type {BaseConfig} from "./types";

const config: BaseConfig = {
    deploymentFolder: "deployments",
    defaultNetwork: "mainnet",
    networks: {
        mainnet: {
            url: process.env.MAINNET_RPC_URL,
            api_key: process.env.MAINNET_ETHERSCAN_KEY,
            chainId: 1,
        },
        bsc: {
            url: process.env.BSC_RPC_URL,
            api_key: process.env.BSC_ETHERSCAN_KEY,
            chainId: 56,
            disableVerifyOnDeploy: true,
            enumName: "BSC",
        },
        avalanche: {
            url: process.env.AVALANCHE_RPC_URL,
            api_key: process.env.AVALANCHE_ETHERSCAN_KEY,
            chainId: 43114,
        },
        polygon: {
            url: process.env.POLYGON_RPC_URL,
            api_key: process.env.POLYGON_ETHERSCAN_KEY,
            chainId: 137,
        },
        arbitrum: {
            url: process.env.ARBITRUM_RPC_URL,
            api_key: process.env.ARBITRUM_ETHERSCAN_KEY,
            chainId: 42161,
        },
        optimism: {
            url: process.env.OPTIMISM_RPC_URL,
            api_key: process.env.OPTIMISM_ETHERSCAN_KEY,
            chainId: 10,
            forgeDeployExtraArgs: "--legacy",
        },
        fantom: {
            url: process.env.FANTOM_RPC_URL,
            api_key: process.env.FTMSCAN_ETHERSCAN_KEY,
            chainId: 250,
            profile: "evm_paris",
        },
        moonriver: {
            url: process.env.MOONRIVER_RPC_URL,
            api_key: process.env.MOONRIVER_ETHERSCAN_KEY,
            chainId: 1285,
        },
        kava: {
            api_key: null,
            url: process.env.KAVA_RPC_URL,
            chainId: 2222,
            profile: "evm_paris",
            forgeDeployExtraArgs: "--legacy",
        },
        linea: {
            url: process.env.LINEA_RPC_URL,
            api_key: process.env.LINEA_ETHERSCAN_KEY,
            chainId: 59144,
            profile: "evm_london",
        },
        base: {
            url: process.env.BASE_RPC_URL,
            api_key: process.env.BASE_ETHERSCAN_KEY,
            chainId: 8453,
        },
        bera: {
            url: process.env.BERA_RPC_URL,
            api_key: "verifyContract",
            chainId: 80084,
            forgeVerifyExtraArgs: "--retries 2 --verifier-url https://api.routescan.io/v2/network/testnet/evm/80084/etherscan",
            forgeDeployExtraArgs: "--legacy --verifier-url https://api.routescan.io/v2/network/testnet/evm/80084/etherscan",
            disableSourcify: true, // sourcify not supported on bartio testnet
            disableVerifyOnDeploy: true, // verify on deploy not supported on bartio testnet
        },
    },
};

export default config;

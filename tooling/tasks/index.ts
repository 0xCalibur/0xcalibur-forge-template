import * as BlockNumberTask from "./core/blocknumbers";
import * as CheckConsoleLogTask from "./core/check-console-log";
import * as ForgeDeployTask from "./core/forge-deploy";
import * as ForgeDeployMultichainTask from "./core/forge-deploy-multichain";
import * as PostDeployTask from "./core/post-deploy";
import * as VerifyTask from "./core/verify";
import * as SyncDeploymentsTask from "./core/sync-deployments";
import * as AddressTask from "./core/address";
import * as GenerateMerkleAccountAmountTask from "./gen/merkle-account-amount";
import * as GenerateTask from "./gen/generate";

export const tasks = [
    BlockNumberTask,
    CheckConsoleLogTask,
    ForgeDeployTask,
    ForgeDeployMultichainTask,
    PostDeployTask,
    VerifyTask,
    SyncDeploymentsTask,
    AddressTask,
    GenerateMerkleAccountAmountTask,
    GenerateTask,
];

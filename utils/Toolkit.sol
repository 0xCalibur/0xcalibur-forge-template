// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {Vm} from "forge-std/Vm.sol";
import {LibString} from "@solady/utils/LibString.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {Deployer, DeployerDeployment, Deployer} from "./Deployment.sol";

library ChainId {
    uint256 internal constant Mainnet = 1;
    uint256 internal constant BSC = 56;
    uint256 internal constant Polygon = 137;
    uint256 internal constant Fantom = 250;
    uint256 internal constant Optimism = 10;
    uint256 internal constant Arbitrum = 42161;
    uint256 internal constant Avalanche = 43114;
    uint256 internal constant Moonriver = 1285;
    uint256 internal constant Kava = 2222;
    uint256 internal constant Linea = 59144;
    uint256 internal constant Base = 8453;
    uint256 internal constant Bera = 80084;
}

/// @dev https://layerzero.gitbook.io/docs/technical-reference/mainnet/supported-chain-ids
library LayerZeroChainId {
    uint16 internal constant Mainnet = 101;
    uint16 internal constant BSC = 102;
    uint16 internal constant Avalanche = 106;
    uint16 internal constant Polygon = 109;
    uint16 internal constant Arbitrum = 110;
    uint16 internal constant Optimism = 111;
    uint16 internal constant Fantom = 112;
    uint16 internal constant Moonriver = 167;
    uint16 internal constant Kava = 177;
    uint16 internal constant Linea = 183;
    uint16 internal constant Base = 184;
}

/// @dev https://layerzero.gitbook.io/docs/evm-guides/ua-custom-configuration
library LayerZeroUAConfigType {
    uint256 internal constant CONFIG_TYPE_INBOUND_PROOF_LIBRARY_VERSION = 1;
    uint256 internal constant CONFIG_TYPE_INBOUND_BLOCK_CONFIRMATIONS = 2;
    uint256 internal constant CONFIG_TYPE_RELAYER = 3;
    uint256 internal constant CONFIG_TYPE_OUTBOUND_PROOF_TYPE = 4;
    uint256 internal constant CONFIG_TYPE_OUTBOUND_BLOCK_CONFIRMATIONS = 5;
    uint256 internal constant CONFIG_TYPE_ORACLE = 6;
}

library Block {
    uint256 internal constant Latest = 0;
}

///////////////////////////////////////////////////////////////
/// @dev Json structs for reading from the config files
/// The name must be in alphabetical order as documented here:
/// https://book.getfoundry.sh/cheatcodes/parse-json
struct JsonAddressEntry {
    string key;
    address value;
}

contract JsonConfigDecoder {
    function decodeAddresses(bytes memory jsonContent) external pure returns (JsonAddressEntry[] memory) {
        return abi.decode(jsonContent, (JsonAddressEntry[]));
    }
}

//
///////////////////////////////////////////////////////////////

/// @notice Toolkit is a toolchain contract that stores all the addresses of the contracts
/// and other information and functionnalities that is needed for the deployment scripts and testing.
/// It is not meant to be deployed but to be used for chainops.
contract Toolkit {
    using LibString for string;

    Vm constant vm = Vm(address(bytes20(uint160(uint256(keccak256("hevm cheat code"))))));

    mapping(string => address) private addressMap;
    mapping(uint256 => string) private chainIdToName;

    string[] private addressKeys;

    uint[] public chains = [
        0, // default
        ChainId.Mainnet,
        ChainId.BSC,
        ChainId.Avalanche,
        ChainId.Polygon,
        ChainId.Arbitrum,
        ChainId.Optimism,
        ChainId.Fantom,
        ChainId.Moonriver,
        ChainId.Kava,
        ChainId.Linea,
        ChainId.Base,
        ChainId.Bera
    ];

    bool public testing;
    Deployer public deployer;
    JsonConfigDecoder public decoder;

    constructor() {
        decoder = new JsonConfigDecoder();

        deployer = new Deployer();
        vm.allowCheatcodes(address(deployer));
        vm.makePersistent(address(deployer));
        vm.label(address(deployer), "forge-deploy:deployer");

        chainIdToName[0] = "Default";
        chainIdToName[ChainId.Mainnet] = "Mainnet";
        chainIdToName[ChainId.BSC] = "BSC";
        chainIdToName[ChainId.Polygon] = "Polygon";
        chainIdToName[ChainId.Fantom] = "Fantom";
        chainIdToName[ChainId.Optimism] = "Optimism";
        chainIdToName[ChainId.Arbitrum] = "Arbitrum";
        chainIdToName[ChainId.Avalanche] = "Avalanche";
        chainIdToName[ChainId.Moonriver] = "Moonriver";
        chainIdToName[ChainId.Kava] = "Kava";
        chainIdToName[ChainId.Linea] = "Linea";
        chainIdToName[ChainId.Base] = "Base";
        chainIdToName[ChainId.Bera] = "Bera";

        for (uint i = 0; i < chains.length; i++) {
            uint256 chainId = chains[i];
            (string memory path, string memory filename) = getConfigFileInfo(chainId);
            string memory json = vm.readFile(path);
            bytes memory jsonContent;

            jsonContent = vm.parseJson(json, ".addresses");
            try decoder.decodeAddresses(jsonContent) returns (JsonAddressEntry[] memory entries) {
                for (uint j = 0; j < entries.length; j++) {
                    JsonAddressEntry memory entry = entries[j];
                    setAddress(chainId, entry.key, entry.value);
                }
            } catch {
                revert(string.concat("Decoding of addresses failed for ", filename));
            }
        }
    }

    function loadAddressesFromJson(bytes memory jsonContent) external {
        JsonAddressEntry[] memory entries = abi.decode(jsonContent, (JsonAddressEntry[]));

        for (uint i = 0; i < entries.length; i++) {
            JsonAddressEntry memory entry = entries[i];
            setAddress(0, entry.key, entry.value);
        }
    }

    function getConfigFileInfo(uint256 chainId) public view returns (string memory path, string memory filename) {
        filename = string.concat(chainIdToName[chainId].lower(), ".json");
        path = string.concat(vm.projectRoot(), "/config/", filename);
    }

    function setAddress(uint256 chainid, string memory key, address value) public {
        if (chainid != 0) {
            key = string.concat(chainIdToName[chainid].lower(), ".", key);
        }

        require(addressMap[key] == address(0), string.concat("address already exists: ", key));
        addressMap[key] = value;
        addressKeys.push(key);

        vm.label(value, key);
    }

    function getAddress(string memory key) public view returns (address) {
        // search for current block.chainid format
        string memory localKey = string.concat(chainIdToName[block.chainid].lower(), ".", key);
        if (addressMap[localKey] != address(0)) {
            return addressMap[localKey];
        }

        // search for explicit <chain_name>.key format first
        if (addressMap[key] != address(0)) {
            return addressMap[key];
        }

        revert(string.concat("address not found: ", key));
    }

    function getAddress(uint256 chainid, string memory key) public view returns (address) {
        if (chainid == 0) {
            revert("invalid chainid");
        }

        key = string.concat(chainIdToName[chainid].lower(), ".", key);

        if (addressMap[key] != address(0)) {
            return addressMap[key];
        }

        revert(string.concat("address not found: ", key));
    }

    function getChainName(uint256 chainid) public view returns (string memory) {
        return chainIdToName[chainid];
    }

    function setTesting(bool _testing) public {
        testing = _testing;
    }

    function prefixWithChainName(uint256 chainid, string memory name) public view returns (string memory) {
        return string.concat(getChainName(chainid), "_", name);
    }

    function getChainsLength() public view returns (uint256) {
        return chains.length;
    }

    function formatDecimals(uint256 value) public pure returns (string memory) {
        return formatDecimals(value, 18);
    }

    function formatDecimals(uint256 value, uint256 decimals) public pure returns (string memory str) {
        if (value == 0) {
            return "0";
        }

        uint256 divisor = 10 ** uint256(decimals);
        uint256 integerPart = value / divisor;
        uint256 fractionalPart = value % divisor;

        string memory fractionalPartStr = LibString.toString(fractionalPart);
        bytes memory zeroPadding = new bytes(decimals - bytes(fractionalPartStr).length);

        for (uint256 i = 0; i < zeroPadding.length; i++) {
            zeroPadding[i] = bytes1(uint8(48));
        }

        string memory integerPartStr = "";
        uint128 index;

        while (integerPart > 0) {
            uint256 part = integerPart % 10;
            bool isSet = index != 0 && index % 3 == 0;

            string memory stringified = vm.toString(part);
            string memory glue = ",";

            if (!isSet) glue = "";
            integerPartStr = string(abi.encodePacked(stringified, glue, integerPartStr));

            integerPart = integerPart / 10;
            index += 1;
        }

        return string(abi.encodePacked(integerPartStr, ".", zeroPadding, fractionalPartStr));
    }
}

function getToolkit() returns (Toolkit toolkit) {
    address location = address(bytes20(uint160(uint256(keccak256("toolkit")))));
    toolkit = Toolkit(location);

    if (location.code.length == 0) {
        Vm vm = Vm(address(bytes20(uint160(uint256(keccak256("hevm cheat code"))))));
        bytes memory creationCode = vm.getCode("Toolkit.sol:Toolkit");
        vm.etch(location, abi.encodePacked(creationCode, ""));
        vm.allowCheatcodes(location);
        bytes memory runtimeBytecode = Address.functionCall(location, "");
        vm.etch(location, runtimeBytecode);
        vm.makePersistent(address(location));
        vm.label(location, "toolkit");
    }
}

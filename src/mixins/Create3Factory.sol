// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0;

import {CREATE3} from "@solady/utils/CREATE3.sol";

contract Create3Factory {
    event LogDeployed(address deployed, address sender, bytes32 salt);

    function deploy(bytes32 salt, bytes memory bytecode, uint256 value) public returns (address deployed) {
        deployed = CREATE3.deployDeterministic(value, bytecode, keccak256(abi.encode(msg.sender, salt)));
        emit LogDeployed(deployed, msg.sender, salt);
    }

    function getDeployed(address account, bytes32 salt) public pure returns (address) {
        return CREATE3.predictDeterministicAddress(salt, account);
    }
}

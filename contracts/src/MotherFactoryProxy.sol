// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title MotherFactoryProxy
 * @dev Transparent upgradeable proxy for MotherFactory contract
 * @notice This proxy enables upgradeability for the MotherFactory logic contract
 */
contract MotherFactoryProxy is TransparentUpgradeableProxy {
    /**
     * @notice Constructor for MotherFactoryProxy
     * @param logic Address of the initial MotherFactory logic contract
     * @param admin Address of the proxy admin (can upgrade the contract)
     * @param data Initialization data for the logic contract
     */
    constructor(
        address logic,
        address admin,
        bytes memory data
    ) TransparentUpgradeableProxy(logic, admin, data) {}
}

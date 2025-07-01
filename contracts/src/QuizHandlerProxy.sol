// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";

/**
 * @title QuizHandlerProxy
 * @dev Transparent upgradeable proxy for QuizHandler contract
 * @notice This proxy enables upgradeability for the QuizHandler logic contract
 */
contract QuizHandlerProxy is TransparentUpgradeableProxy {
    /**
     * @notice Constructor for QuizHandlerProxy
     * @param logic Address of the initial QuizHandler logic contract
     * @param admin Address of the proxy admin (can upgrade the contract)
     * @param data Initialization data for the logic contract
     */
    constructor(
        address logic,
        address admin,
        bytes memory data
    ) TransparentUpgradeableProxy(logic, admin, data) {}
}

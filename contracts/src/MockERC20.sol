// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20
 * @dev A simple ERC20 token for testing purposes
 */
contract MockERC20 is ERC20 {
    uint8 private _decimals;

    /**
     * @dev Constructor for the mock token
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param initialSupply The initial supply of tokens to mint
     * @param decimals_ The number of decimals to use (defaults to 18)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 decimals_
    ) ERC20(name, symbol) {
        _decimals = decimals_;
        _mint(msg.sender, initialSupply);
    }

    /**
     * @dev Returns the number of decimals used by the token
     */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /**
     * @dev Mint tokens to a specific address (for testing)
     * @param to The address to mint tokens to
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.6.0;

/**
 * @title ERC20
 * @dev The ERC20 interface provides simple interfacing with EcoBucks contract
 */
// solhint-disable-next-line
abstract contract ERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 tokens
    ) public virtual returns (bool success);

    function balanceOf(address tokenOwner) public virtual view returns (uint256 balance);

    function allowance(address tokenOwner, address spender)
        public
        virtual
        view
        returns (uint256 remaining);

    event Transfer(address indexed from, address indexed to, uint256 tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint256 tokens);
}

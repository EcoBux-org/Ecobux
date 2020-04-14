pragma solidity >=0.6.0;


/**
 * @title ERC20
 * @dev The ERC20 interface provides simple interfacing with ecoBucks
*/
abstract contract ERC20 {
    function balanceOf(address tokenOwner) public view virtual returns (uint balance);
    function allowance(address tokenOwner, address spender) public view virtual returns (uint remaining);
    function transferFrom(address from, address to, uint tokens) public virtual returns (bool success);

    event Transfer(address indexed from, address indexed to, uint tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint tokens);
}

pragma solidity 0.5.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20Mintable.sol";
import "./utils/Ownable.sol";
// Now using new openzeppelin's gsn
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

contract EcoBux is ERC20, ERC20Mintable, Ownable {
    event Mint(address indexed to, uint256 amount);

    ERC20 public ecoAddress = ERC20(address(this));

    string public constant name = "EcoBux";
    string public constant symbol = "ECOB";
    uint8 public constant decimals = 2;

    modifier hasMintPermission() {
        require(msg.sender == owner);
        _;
    }

    // Fallback function
    // solhint-disable-next-line no-empty-blocks
    function() external {
    }

    /**
    * @dev Function to mint tokens to users
    * @param _to The address that will receive the minted tokens.
    * @param _amount The amount of tokens to mint.
    * @return A boolean that indicates if the operation was successful.
    */
    function createEco(address _to, uint256 _amount) public hasMintPermission returns (bool) {
        mint(_to, _amount); // Mints tokens and sends them to _to
        emit Mint(_to, _amount); // Calls mint event
        return true;
    }

}

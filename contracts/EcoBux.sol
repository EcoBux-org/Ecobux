pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./utils/Ownable.sol";
// Now using new openzeppelin's gsn
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";


contract EcoBux is ERC20, Ownable {
    event Mint(address indexed to, uint256 amount);

    ERC20 public ecoAddress = ERC20(address(this));

    constructor() public ERC20("EcoBux", "ECOB") {
        _setupDecimals(2);
    }

    modifier hasMintPermission() {
        require(msg.sender == owner);
        _;
    }

    /**
     * @dev Function to mint tokens to users
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return A boolean that indicates if the operation was successful.
     */
    function createEco(address _to, uint256 _amount)
        public
        hasMintPermission
        returns (bool)
    {
        super._mint(_to, _amount);
        emit Mint(_to, _amount); // Calls mint event
        return true;
    }
}

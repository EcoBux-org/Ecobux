pragma solidity ^0.6.0;
// Import OpenZeppelin's ERC-20 Implementation
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// Import OpenZeppelin's SafeMath Implementation
import "@openzeppelin/contracts/math/SafeMath.sol";
// Now using new openzeppelin's gsn
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";
import "./utils/Ownable.sol";
import "./utils/Pausable.sol";

contract PanamaFuture is ERC20, Ownable, Pausable {
    using SafeMath for uint256;

    uint256 public currentPrice;
    ERC20 public ecoBuxAddress;

    // Event emitted whenever Future are transferred
    event Transferred(address owner, uint256 amount);

    // Event emitted when ECOB are transferred from user to contract
    event EcoTransfer(address owner, uint256 amount);

    // Start contract with new EcoBux address
    constructor(address _ecoBuxAddress) public ERC20("PanamaFuture", "PAF") {
        ERC20 futureAddress = ERC20(address(this));
        ecoBuxAddress = ERC20(_ecoBuxAddress);
        currentPrice = 25; // Default to 1 ECOB per FUTURE. Changed by setCurrentPrice()
    }

    /** @dev Fuction to interface with creating and dispensing Future
     * @param _amount Number of Future desired
     */
    function buyFuture(uint256 _amount)
        external
        whenNotPaused
        returns (uint256)
    {
        // Require at least current price * tokens
        require(availableECO(msg.sender) >= _amount * currentPrice, "Not Enough EcoBux"); 

        // Mint tokens and sends them to the original sender
        super._mint(msg.sender, _amount);

        // Take money from account
        takeEco(msg.sender, currentPrice * _amount);

        // Emit Transferred after Future is transferred 
        emit Transferred(msg.sender, _amount);
    }

    /** @dev Function to update _currentPrice
     * @dev Throws if _currentPrice is zero
     */
    function setCurrentPrice(uint256 _currentPrice) public onlyOwner {
        currentPrice = _currentPrice;
    }

    /** @dev Function to update ecoBuxAddress
     * @dev Throws if _ecoBuxAddress is not a contract address
     */
    function setEcoBuxAddress(address _ecoBuxAddress) public onlyOwner {
        ecoBuxAddress = ERC20(_ecoBuxAddress);
    }

    /** @dev Function to take EcoBux from user and transfers it to contract
     */
    function takeEco(address _from, uint256 _amount) internal {
        require(availableECO(_from) >= _amount, "Not Enough EcoBux"); // Requre enough EcoBux available
        ecoBuxAddress.transferFrom(_from, address(this), _amount);
        emit EcoTransfer(_from, _amount);
    }

    /** @dev Function to verify user has enough EcoBux to spend
     */
    function availableECO(address user) internal view returns (uint256) {
        return ecoBuxAddress.allowance(user, address(this));
    }
}

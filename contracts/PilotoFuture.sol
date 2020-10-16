// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.7.0;

// Import OpenZeppelin's ERC-20 Implementation
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// OpenZeppelin's SafeMath Implementation is used to avoid overflows
import "@openzeppelin/contracts/math/SafeMath.sol";
// OpenZeppelin's GSN: Users dont need to hold ETH to transact ECOB
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

// Permission abstract contracts to control contract after deploy
import "./utils/Ownable.sol";
import "./utils/Pausable.sol";

contract PilotoFuture is ERC20, Ownable, Pausable, GSNRecipient {
    // Prevents overflows with uint256
    using SafeMath for uint256;

    uint256 public currentPrice;
    ERC20 public ecoBuxAddress;

    // Event emitted when ECOB are transferred from user to contract
    event EcoTransfer(address owner, uint256 amount);

    // Start contract with new EcoBux address
    constructor(address _ecoBuxAddress) ERC20("PilotoFuture", "PILOF") {
        _setupDecimals(0);
        ecoBuxAddress = ERC20(_ecoBuxAddress);
        currentPrice = 1500; // Default to 15 ECOB per FUTURE. Changed by setCurrentPrice()
    }

    /** @dev Function to interface with creating and dispensing Future
     * @param _amount Number of Future desired
     */
    function buyFuture(uint256 _amount) external whenNotPaused returns (uint256) {
        // Require at least current price * tokens
        require(availableECO(_msgSender()) >= _amount * currentPrice, "Not Enough EcoBux");

        // Take money from account
        takeEco(_msgSender(), currentPrice * _amount);

        // Mint tokens and sends them to the original sender
        super._mint(_msgSender(), _amount);

        // Emit Transfer after Future is transferred
        emit Transfer(address(0), _msgSender(), _amount);
    }

    // Relay Functions to allow users to avoid needing a wallet
    // Required by GSN
    // TODO: LIMIT USE OF THIS; ANY USER CAN DRAIN
    function acceptRelayedCall(
        address relay,
        address from,
        bytes calldata encodedFunction,
        uint256 transactionFee,
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 nonce,
        bytes calldata approvalData,
        uint256 maxPossibleCharge
    ) external view override returns (uint256, bytes memory) {
        return _approveRelayedCall();
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

    // Relay Requires this func even if unused
    // Required by GSN
    // TODO: Add stuff here
    function _preRelayedCall(bytes memory context) internal override returns (bytes32) {
        // TODO
    }

    // Required by GSN
    function _postRelayedCall(
        bytes memory context,
        bool,
        uint256 actualCharge,
        bytes32
    ) internal override {
        // TODO
    }

    // Required by GSN
    function _msgSender() internal view override(Context, GSNRecipient) returns (address payable) {
        return GSNRecipient._msgSender();
    }

    // Required by GSN
    function _msgData() internal view override(Context, GSNRecipient) returns (bytes memory) {
        return GSNRecipient._msgData();
    }

    /** @dev Function to take ecobux from user and transfer to this contract
     * @param _from address to take ecobux from
     * @param _amount how much ecobux (in atomic units) to take
     */
    function takeEco(address _from, uint256 _amount) internal {
        require(availableECO(_from) >= _amount, "Not Enough EcoBux"); // Requre enough EcoBux available
        ecoBuxAddress.transferFrom(_from, address(this), _amount);
        emit EcoTransfer(_from, _amount);
    }

    /** @dev Function to verify user has enough ecobux to spend
     * @param user address of user to verify
     */
    function availableECO(address user) internal view returns (uint256) {
        return ecoBuxAddress.allowance(user, address(this));
    }
}

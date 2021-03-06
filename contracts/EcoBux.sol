// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.6.0;

// Use OpenZeppelin's ERC20 abstract contract for base functions
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// OpenZeppelin's GSN: Users dont need to hold ETH to transact ECOB
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";

// Permission abstract contracts to control contract after deploy
import "./utils/Ownable.sol";

contract EcoBux is ERC20, Ownable, GSNRecipient {
    event Mint(address indexed to, uint256 amount);

    ERC20 public ecoAddress = ERC20(address(this));

    constructor() public ERC20("EcoBux", "ECOB") {
        _setupDecimals(2);
    }

    modifier hasMintPermission() {
        require(msg.sender == owner, "Must be owner to mint");
        _;
    }

    // Relay Functions to allow users to avoid needing a wallet
    // GSN func
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
    ) external override view returns (uint256, bytes memory) {
        return _approveRelayedCall();
    }

    /** @notice Function to mint tokens to users
     * @param _to The address that will receive the minted tokens.
     * @param _amount The amount of tokens to mint.
     * @return boolean indicating if the operation was successful.
     */
    function createEco(address _to, uint256 _amount) public hasMintPermission returns (bool) {
        super._mint(_to, _amount);
        emit Mint(_to, _amount); // Calls mint event
        return true;
    }

    // Relay Requires this func even if unused
    // GSN Func
    // TODO: Add stuff here
    function _preRelayedCall(bytes memory context) internal override returns (bytes32) {
        // TODO
    }

    function _postRelayedCall(
        bytes memory context,
        bool,
        uint256 actualCharge,
        bytes32
    ) internal override {
        // TODO
    }

    // Needed by Openzeppelin GSN
    function _msgSender() internal override(Context, GSNRecipient) view returns (address payable) {
        return GSNRecipient._msgSender();
    }

    function _msgData() internal override(Context, GSNRecipient) view returns (bytes memory) {
        return GSNRecipient._msgData();
    }
}

pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./utils/Ownable.sol";
// Now using new openzeppelin's gsn
import "@openzeppelin/contracts/GSN/GSNRecipient.sol";


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
    ) external view override returns (uint256, bytes memory) {
        return _approveRelayedCall();
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
    function _msgSender() internal view override(Context, GSNRecipient) returns (address payable) {
        return GSNRecipient._msgSender();
    }

    function _msgData() internal view override(Context, GSNRecipient) returns (bytes memory) {
        return GSNRecipient._msgData();
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

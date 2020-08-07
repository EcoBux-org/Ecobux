// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.6.0;

// OpenZeppelin's SafeMath Implementation is used to avoid overflows
import "@openzeppelin/contracts/math/SafeMath.sol";

// Interface contract to interact with EcoBux and ERC20 subcontracts
import "./utils/Erc20.sol";
// Interface contracts to interact with ERC721 subcontracts 
import "./utils/Erc721.sol";
import "./utils/Erc721Verifiable.sol";


// TODO: Add GSN
contract MarketPlace {
    // Prevents overflows with uint256
    using SafeMath for uint256;

    // Declare ecobux address
    ERC20 public ecoBux;
    // EcoBux Fee is a empty smart contract used to "burn" EcoBux
    // All EcoBux in this contract is money given to EcoBux to cover gas fees and 
    // Other operational costs.
    ERC20 public ecoBuxFee;
    uint256 public fee;

    bytes4 public constant ERC721_INTERFACE = bytes4(0x80ac58cd);

    bytes4 public constant INTERFACEID_VALIDATEFINGERPRINT = bytes4(
        keccak256("verifyFingerprint(uint256,bytes)")
    );

    // Start contract with EcoBux address and Fee address as parameters
    constructor(address _ecoBuxAddress, address _ecoBuxFeeAddress) public {
        ecoBux = ERC20(_ecoBuxAddress);
        ecoBuxFee = ERC20(_ecoBuxFeeAddress);
        // Base percentage of every executed order, in EcoBux
        // 2 = 2%
        fee = 2; 
    }

    event OrderCreated(
        bytes32 id,
        uint256 indexed assetId,
        address indexed assetOwner,
        address subTokenAddress,
        uint256 ecoPrice
    );

    event OrderSuccessful(
        bytes32 id,
        uint256 indexed assetId,
        address indexed seller,
        address subTokenAddress,
        uint256 totalPrice,
        address indexed buyer
    );

    event OrderCancelled(
        bytes32 id,
        uint256 indexed assetId,
        address indexed seller,
        address subTokenAddress
    );

    event EcoTransfer(address owner, uint256 amount);

    // Struct defines order properties
    struct Order {
        // Order ID
        bytes32 id;
        // Charity contract address
        address subTokenAddress;
        // Price (in ecob) for the published item
        uint256 price;
        // Owner of the asset
        address seller;
    }

    // Mapping of all active trades
    mapping(address => mapping(uint256 => Order)) public orderByAssetId;

    /** @dev Create order
     */
    function createOrder(
        address subTokenAddress,
        uint256 assetId,
        uint256 ecoPrice
    ) external {
        _requireERC721(subTokenAddress);

        ERC721 subToken = ERC721(subTokenAddress);
        address assetOwner = subToken.ownerOf(assetId);

        require(msg.sender == assetOwner, "Only the owner can make orders");
        require(
            subToken.getApproved(assetId) == address(this) ||
                subToken.isApprovedForAll(assetOwner, address(this)),
            "The contract is not authorized to manage the asset"
        );

        // Create unique orderId 
        bytes32 orderId = keccak256(
            abi.encodePacked(
                block.timestamp,
                assetOwner,
                assetId,
                subTokenAddress,
                ecoPrice
            )
        );

        orderByAssetId[subTokenAddress][assetId] = Order({
            id: orderId,
            subTokenAddress: subTokenAddress,
            price: ecoPrice,
            seller: assetOwner
        });

        emit OrderCreated(
            orderId,
            assetId,
            assetOwner,
            subTokenAddress,
            ecoPrice
        );
    }

    /** @dev Cancel existing order
     */
    function cancelOrder(address subTokenAddress, uint256 assetId)
        external
    {
        Order memory order = orderByAssetId[subTokenAddress][assetId];

        require(order.id != 0, "Asset not published");
        require(
            order.seller == msg.sender,
            "Unauthorized user"
        );

        bytes32 orderId = order.id;
        address orderSeller = order.seller;
        address orderTokenAddress = order.subTokenAddress;
        delete orderByAssetId[subTokenAddress][assetId];

        emit OrderCancelled(
            orderId,
            assetId,
            orderSeller,
            orderTokenAddress
        );
    }

    /** @dev Execute sale of order
     */
    function executeOrder(
        address subTokenAddress,
        uint256 assetId,
        uint256 price
        //bytes calldata fingerprint
    ) external {
        _requireERC721(subTokenAddress);

        ERC721Verifiable nftRegistry = ERC721Verifiable(subTokenAddress);

        Order memory order = orderByAssetId[subTokenAddress][assetId];
        require(order.id != 0, "Asset not published");

        address seller = order.seller;
        require(seller != msg.sender, "Seller cannot buy asset");
        require(order.price == price, "The price is not correct");
        require(
            seller == nftRegistry.ownerOf(assetId),
            "The seller not the owner"
        );
        require(
            _availableECO(msg.sender) >= price,
            "Not Enough EcoBux"
        );

        bytes32 orderId = order.id;
        delete orderByAssetId[subTokenAddress][assetId];

        // Transfer fees if exists
        if (fee > 0) {
            // Fee must be divided by 200 to split the fee between charity and EcoBux
            require(
                _takeEco(msg.sender, subTokenAddress, uint (price * fee)/200),
                "Transfering the charity fee to the charity failed"
            );
            require(
                _takeEco(msg.sender, address(ecoBuxFee), uint (price * fee)/200),
                "Transfering the project fee to the EcoBux owner failed"
            );
        }

        // Transfer sale amount to seller
        require(
            _takeEco(
                msg.sender,
                seller,
                // Get the price - fees and add one to the seller if the fee cant be split evenly
                price*(100-fee)/100 + ((price * (100 - (fee/2)) % 10 != 0 ? 1 : 0))
            ),
            "Transfering the sale amount to the seller failed"
        );

        // Transfer asset 
        nftRegistry.safeTransferFrom(seller, msg.sender, assetId);

        emit OrderSuccessful(
            orderId,
            assetId,
            seller,
            subTokenAddress,
            price,
            msg.sender
        );
    }

    function _requireERC721(address subTokenAddress) internal view {
        require(isContract(subTokenAddress), "Address must be a contract");

        ERC721 nftRegistry = ERC721(subTokenAddress);
        require(
            nftRegistry.supportsInterface(ERC721_INTERFACE),
            "Contract has an invalid ERC721 implementation"
        );
    }

    /** @dev Function to verifie user has enough EcoBux to spend
     */
    function _availableECO(address user) internal view returns (uint256) {
        return ecoBux.allowance(user, address(this));
    }

    /** @dev Function to take EcoBux from user and transfer to contract
     */
    function _takeEco(
        address _from,
        address _to,
        uint256 _amount
    ) internal returns (bool) {
        require(_availableECO(_from) >= _amount, "Not enough EcoBux in takeEco");
        require(
            ecoBux.transferFrom(_from, _to, _amount),
            "Transfer of EcoBux failed"
        );
        emit EcoTransfer(_from, _amount);
        return true;
    }

    /** @dev Function determine if input is contract
     * @return bool if input is a contract
     */
    function isContract(address _addr) internal view returns (bool) {
        uint32 size;
        assembly {
            size := extcodesize(_addr)
        }
        return (size > 0);
    }
}

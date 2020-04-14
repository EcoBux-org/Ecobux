pragma solidity >=0.6.0;
import "./Erc721.sol";


abstract contract ERC721Verifiable is ERC721 {
    function verifyFingerprint(uint256, bytes memory) public view virtual returns (bool);
}

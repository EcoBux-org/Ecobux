pragma solidity 0.5.10;
import "./Erc721.sol";


contract ERC721Verifiable is ERC721 {
    function verifyFingerprint(uint256, bytes memory) public view returns (bool);
}

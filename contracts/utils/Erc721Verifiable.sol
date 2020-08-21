// SPDX-License-Identifier: AGPL-3.0
pragma solidity >=0.6.0;
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

// solhint-disable-next-line
abstract contract ERC721Verifiable is IERC721 {
    function verifyFingerprint(uint256, bytes memory) public virtual view returns (bool);
}

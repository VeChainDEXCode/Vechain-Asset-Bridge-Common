// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./Library_Merkle.sol";

contract MerkleControl {
    
    address public master;
    bool public masterLocked = false;

    constructor(){
        master = msg.sender;
    }

    mapping(bytes32 => bool) public merkleroots;

    event SubmitLeafEvent(bytes32 _leaf);
    event VerifierUpdated(address indexed _addr);
    event MasterUpdated(address indexed _addr);
    event MasterLockChanged(bool indexed _status);
    event UpdateMerkleRoot(bytes32 indexed _root,bytes[] _args);

    function submitLeaf(bytes32 _leaf) internal {
        emit SubmitLeafEvent(_leaf);
    }

    function setMaster(address _addr) external onlyMaster {
        master = _addr;
        emit MasterUpdated(_addr);
    }

    function updateMerkleRoot(bytes32 _root,bytes[] calldata _args) external onlyMaster masterUnlock {
        merkleroots[_root] = true;
        emit UpdateMerkleRoot(_root,_args);
    }

    function setMasterLock(bool _status) external onlyMaster {
        masterLocked = _status;
        emit MasterLockChanged(_status);
    }

    function merklrProofVerify(bytes32[] memory _proof, bytes32 _root, bytes32 _leaf) external view returns(bool){
        return merkleroots[_root] && MerkleProof.verify(_proof, _root, _leaf);
    }

    modifier onlyMaster() {
        require(msg.sender == master, "permission denied");
        _;
    }

    modifier masterUnlock() {
        require(masterLocked == false, "the bridge locked by governance");
        _;
    }
}

// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

interface IBridge {
    function updateMerkleRoot(bytes32 _root,bytes[] calldata _args) external;
    function proofVerify(bytes32 _root,bytes32 _leaf,bytes32[] calldata _proof) external view returns(bool);

    event SubmitHashEvent(bytes32 indexed _value);
    event UpdateMerkleRoot(bytes32 indexed _root,bytes[] _args);
} 
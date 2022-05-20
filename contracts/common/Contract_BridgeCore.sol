// SPDX-License-Identifier: GPL-3.0-only
pragma solidity ^0.8.0;

import "./Library_Merkle.sol";

contract BridgeCoreControl {
    address public master;
    address public governance;
    address public validator;

    bool public govLocked = false;
    bool public masterLocked = false;

    string public chainname;
    string public chainid;

    event MasterChanged(address indexed _prev, address indexed _new);
    event GovernanceChanged(address indexed _prev, address indexed _new);
    event ValidatorChanged(address indexed _prev, address indexed _new);
    event MasterLockChanged(bool indexed _value);
    event GovLockChanaged(bool indexed _value);

    function setMaster(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied"
        );
        emit MasterChanged(master, _new);
        master = _new;
    }

    function setGovernance(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied"
        );
        emit GovernanceChanged(governance, _new);
        governance = _new;
    }

    function setValidator(address _new) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied"
        );
        emit ValidatorChanged(validator, _new);
        validator = _new;
    }

    function setMasterLock(bool _value) external onlyMaster {
        masterLocked = _value;
        emit MasterLockChanged(_value);
    }

    function setGovLock(bool _value) external onlyGovernance {
        govLocked = _value;
        emit GovLockChanaged(_value);
    }

    modifier onlyGovernance() {
        require(msg.sender == governance, "Permission denied");
        _;
    }

    modifier onlyMaster(){
        require(msg.sender == master,"Permission denied");
        _;
    }

    modifier onlyValidator() {
        require(msg.sender == validator, "Permission denied");
        _;
    }

    modifier masterUnlock() {
        require(
            masterLocked == false || msg.sender == master,
            "Master Lock bridge"
        );
        _;
    }

    modifier govUnlock() {
        require(
            govLocked == false || msg.sender == governance,
            "Governance Lock bridge"
        );
        _;
    }
}

contract BridgeCore is BridgeCoreControl {
    mapping(address => bytes32) public contractMap;
    mapping(bytes32 => address) public appids;
    uint256 public appCount = 0;

    struct RootInfo {
        uint256 index;
        bytes args;
    }

    bytes32[] public rootList;
    mapping(bytes32 => RootInfo) public rootInfo;

    event AddAppid(bytes32 indexed _appid);
    event UpdateAdmin(
        bytes32 indexed _appid,
        address indexed _prev,
        address indexed _new
    );
    event AddContract(bytes32 indexed _appid, address indexed _addr);
    event DelContract(bytes32 indexed _appid, address indexed _addr);
    event SubmitHashEvent(bytes32 indexed _appid, address indexed _sender,bytes32 indexed _value);
    event UpdateMerkleRoot(bytes32 indexed _root, bytes _args);

    constructor(string memory _chainname, string memory _chainid,bytes memory _args) {
        chainname = _chainname;
        chainid = _chainid;
        master = msg.sender;
        governance = msg.sender;
        rootInfo[0x0000000000000000000000000000000000000000000000000000000000000001] = RootInfo(0,_args);
        rootList.push(0x0000000000000000000000000000000000000000000000000000000000000001);
        emit UpdateMerkleRoot(0x0000000000000000000000000000000000000000000000000000000000000001,_args);
    }

    function rootCount() external view returns (uint256) {
        return rootList.length - 1;
    }

    function addAppid(bytes32 _newid,address _admin) external {
        require(
            msg.sender == governance || msg.sender == master,
            "Permission denied"
        );
        require(appids[_newid] == address(0), "Appid existed");
        appCount++;
        appids[_newid] = _admin;
        emit AddAppid(_newid);
    }

    function updateAdmin(bytes32 _appid, address _admin)
        external
        appidExisted(_appid)
    {
        require(
            appids[_appid] == msg.sender ||
                msg.sender == governance ||
                msg.sender == master,
            "Permission denied"
        );
        emit UpdateAdmin(_appid, appids[_appid], _admin);
        appids[_appid] = _admin;
    }

    function addContract(bytes32 _appid, address _addr)
        external
        onlyAdmin(_appid)
        appidExisted(_appid)
    {
        require(contractMap[_addr] == bytes32(0), "Contract registed");
        contractMap[_addr] = _appid;
        emit AddContract(_appid, _addr);
    }

    function delContract(bytes32 _appid, address _addr)
        external
        onlyAdmin(_appid)
        appidExisted(_appid)
    {
        require(contractMap[_addr] == _appid, "Contract not register");
        contractMap[_addr] = bytes32(0);
        emit DelContract(_appid, _addr);
    }

    function submitHash(bytes32 _appid, bytes32 _hash) external {
        require(appids[_appid] != address(0), "Appid not exists");
        require(contractMap[msg.sender] == _appid, "Permission denied");
        emit SubmitHashEvent(_appid,msg.sender,_hash);
    }

    function updateMerkleRoot(bytes32 _root, bytes calldata _args)
        external
        onlyValidator
        masterUnlock
        govUnlock
    {
        rootInfo[_root] = RootInfo(rootList.length,_args);
        rootList.push(_root);
        emit UpdateMerkleRoot(_root, _args);
    }

    function proofVerify(
        bytes32 _root,
        bytes32 _appid,
        bytes32 _hash,
        bytes32[] calldata _proof
    ) external view returns (bool) {
        require(rootInfo[_root].index != 0, "Merkleroot invalid");
        bytes32 leaf = keccak256(abi.encodePacked(_appid, _hash));
        return MerkleProof.verify(_proof, _root, leaf);
    }

    modifier appidExisted(bytes32 _appid) {
        require(appids[_appid] != address(0), "Appid not exists");
        _;
    }

    modifier onlyAdmin(bytes32 _appid) {
        require(appids[_appid] == msg.sender, "Permission denied");
        _;
    }
}
